import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getGeminiModel } from '@/lib/gemini';
import { parseRecipeFromUrl } from '@/lib/recipe-parser';
import { sendPushNotificationToHousehold } from '@/lib/push';

// Helper to get active household ID
async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;

  const firstHousehold = await prisma.household.findFirst();
  return firstHousehold?.id || 'default-household';
}

export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { prompt, imageBase64, imageMimeType, customApiKey, activeMemberId } = body;

    if (!prompt && !imageBase64) {
      return NextResponse.json({ error: 'Please provide a message or image' }, { status: 400 });
    }

    // Get household members and aisles for context
    const [members, aisles] = await Promise.all([
      prisma.user.findMany({ where: { householdId } }),
      prisma.aisleCategory.findMany({ where: { householdId }, orderBy: { orderIndex: 'asc' } }),
    ]);

    const memberNames = members.map((m) => `${m.name} (${m.role})`).join(', ');
    const aisleNames = aisles.map((a) => a.name).join(', ');
    const currentDate = new Date().toISOString().split('T')[0];
    const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const contextAddition = `\nContext Information:
- Current Date: ${currentDate} (${currentDayName})
- Family Members in Household: ${memberNames || 'Joshua (Parent)'}
- Household Grocery Aisles (in order): ${aisleNames || 'Produce, Bakery, Meat, Dairy, Pantry, Frozen, Other'}
- Household ID: ${householdId}`;

    const model = getGeminiModel(customApiKey);

    // Build content parts
    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: imageMimeType || 'image/jpeg',
        },
      });
    }

    parts.push({
      text: `${prompt || 'Analyze this image and assist the family accordingly.'}\n${contextAddition}`,
    });

    const result = await model.generateContent(parts);
    const response = result.response;
    const functionCalls = response.functionCalls();

    const actionsExecuted: any[] = [];
    let assistantMessage = response.text() || '';

    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        const { name } = call;
        const toolArgs = (call.args || {}) as any;

        // 1. Tool: add_grocery_items
        if (name === 'add_grocery_items' && toolArgs.items) {
          const itemsToAdd = toolArgs.items as Array<{
            name: string;
            category?: string;
            quantity?: string;
            note?: string;
          }>;

          const createdItems = [];
          for (const item of itemsToAdd) {
            // Find matching aisle or fallback
            const matchedAisle = aisles.find(
              (a) =>
                a.name.toLowerCase().includes((item.category || '').toLowerCase()) ||
                (item.category || '').toLowerCase().includes(a.name.toLowerCase())
            ) || aisles.find((a) => a.name === 'Other') || aisles[0];

            const created = await prisma.groceryItem.create({
              data: {
                name: item.name,
                category: item.category || matchedAisle?.name || 'Other',
                aisleId: matchedAisle?.id,
                quantity: item.quantity || '1',
                note: item.note,
                checked: false,
                householdId,
                addedById: activeMemberId,
              },
            });
            createdItems.push(created);
          }

          actionsExecuted.push({
            type: 'grocery_added',
            summary: `Added ${createdItems.length} item(s) to grocery list`,
            data: createdItems,
          });

          // Send push notification
          sendPushNotificationToHousehold(householdId, {
            title: '🛒 Grocery List Updated',
            body: `Added: ${createdItems.map((i) => i.name).join(', ')}`,
            url: '/grocery',
          });
        }

        // 2. Tool: add_calendar_events
        else if (name === 'add_calendar_events' && toolArgs.events) {
          const eventsToAdd = toolArgs.events as Array<{
            title: string;
            date: string;
            startTime?: string;
            endTime?: string;
            category?: string;
            assignedMemberName?: string;
            location?: string;
            description?: string;
          }>;

          const createdEvents = [];
          for (const ev of eventsToAdd) {
            const matchedMember = members.find((m) =>
              m.name.toLowerCase().includes((ev.assignedMemberName || '').toLowerCase())
            );

            const created = await prisma.calendarEvent.create({
              data: {
                title: ev.title,
                date: ev.date,
                startTime: ev.startTime,
                endTime: ev.endTime,
                category: (ev.category as any) || 'Family',
                color: matchedMember?.color || '#6366f1',
                location: ev.location,
                description: ev.description,
                assignedMemberId: matchedMember?.id,
                householdId,
              },
            });
            createdEvents.push(created);
          }

          actionsExecuted.push({
            type: 'calendar_event_added',
            summary: `Scheduled ${createdEvents.length} event(s) on the family calendar`,
            data: createdEvents,
          });

          // Send push notification
          sendPushNotificationToHousehold(householdId, {
            title: '📅 New Calendar Event',
            body: createdEvents.map((e) => `${e.title} (${e.date})`).join(', '),
            url: '/calendar',
          });
        }

        // 3. Tool: create_meal_plan
        else if (name === 'create_meal_plan' && toolArgs.meals) {
          const mealsToAdd = toolArgs.meals as Array<{
            date: string;
            mealType: string;
            title: string;
            notes?: string;
            addIngredientsToGrocery?: boolean;
            ingredients?: string[];
          }>;

          const createdMeals = [];
          for (const m of mealsToAdd) {
            const created = await prisma.mealPlan.upsert({
              where: {
                householdId_date_mealType: {
                  householdId,
                  date: m.date,
                  mealType: m.mealType,
                },
              },
              update: {
                title: m.title,
                notes: m.notes,
              },
              create: {
                date: m.date,
                mealType: m.mealType,
                title: m.title,
                notes: m.notes,
                householdId,
              },
            });
            createdMeals.push(created);

            // If requested, also add ingredients to grocery list
            if (m.addIngredientsToGrocery && m.ingredients && m.ingredients.length > 0) {
              for (const ing of m.ingredients) {
                const matchedAisle = aisles.find((a) => a.name === 'Produce') || aisles[0];
                await prisma.groceryItem.create({
                  data: {
                    name: ing,
                    category: matchedAisle?.name || 'Pantry',
                    aisleId: matchedAisle?.id,
                    householdId,
                    addedById: activeMemberId,
                  },
                });
              }
            }
          }

          actionsExecuted.push({
            type: 'meal_planned',
            summary: `Scheduled ${createdMeals.length} meal(s) for the week`,
            data: createdMeals,
          });
        }

        // 4. Tool: create_custom_list
        else if (name === 'create_custom_list') {
          const { name: listName, type, icon, color, items } = toolArgs as {
            name: string;
            type?: string;
            icon?: string;
            color?: string;
            items: string[];
          };

          const customList = await prisma.customList.create({
            data: {
              name: listName,
              type: type || 'checklist',
              icon: icon || '📋',
              color: color || '#10b981',
              householdId,
            },
          });

          if (items && Array.isArray(items)) {
            for (const item of items) {
              await prisma.groceryItem.create({
                data: {
                  name: item,
                  category: 'List Item',
                  householdId,
                  listId: customList.id,
                  addedById: activeMemberId,
                },
              });
            }
          }

          actionsExecuted.push({
            type: 'list_created',
            summary: `Created custom checklist "${listName}" with ${items?.length || 0} items`,
            data: customList,
          });
        }

        // 5. Tool: import_recipe_from_url
        else if (name === 'import_recipe_from_url' && toolArgs.url) {
          try {
            const parsed = await parseRecipeFromUrl(toolArgs.url as string, customApiKey);
            const recipe = await prisma.recipe.create({
              data: {
                title: parsed.title,
                description: parsed.description,
                imageUrl: parsed.imageUrl,
                prepTime: parsed.prepTime,
                cookTime: parsed.cookTime,
                servings: parsed.servings,
                sourceUrl: parsed.sourceUrl,
                ingredients: JSON.stringify(parsed.ingredients),
                instructions: JSON.stringify(parsed.instructions),
                tags: (parsed.tags || []).join(', '),
                householdId,
              },
            });

            actionsExecuted.push({
              type: 'recipe_imported',
              summary: `Imported recipe: "${parsed.title}"`,
              data: recipe,
            });
          } catch (recipeErr: any) {
            console.error('Recipe import error in assistant:', recipeErr);
          }
        }
      }
    }

    if (!assistantMessage && actionsExecuted.length > 0) {
      assistantMessage = `Done! I've ${actionsExecuted.map((a) => a.summary.toLowerCase()).join(' and ')}.`;
    }

    return NextResponse.json({
      message: assistantMessage,
      actions: actionsExecuted,
    });
  } catch (error: any) {
    console.error('Assistant API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Assistant failed to process request',
        message: `I encountered an issue: ${error.message || 'Please check your Gemini API key in Settings.'}`,
      },
      { status: 500 }
    );
  }
}

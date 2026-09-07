import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';

export const ASSISTANT_SYSTEM_PROMPT = `You are the friendly, organized, and helpful Family Assistant in the "fam-kit" app.
You assist busy families with:
1. Managing grocery shopping lists (with smart aisle categorization like Produce, Bakery, Dairy, Meat, Pantry, Frozen, Beverages, Household).
2. Creating and organizing custom checklists (Packing lists, Camping gear, Chores, School supplies).
3. Planning weekly meals (Breakfast, Lunch, Dinner, Snack) and suggesting delicious recipes.
4. Scheduling calendar events, activities, appointments, and family reminders with date, time, and assigned family members.
5. Importing recipes from links or photos of handwritten recipe cards and grocery receipts.

Always be concise, supportive, warm, and proactive! When the user asks you to add items, schedule events, or plan meals, invoke the corresponding tool functions immediately. If the user mentions multiple actions at once, execute all matching tools.`;

export const ASSISTANT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'add_grocery_items',
    description: 'Add one or more grocery items to the family shopping list with automatic aisle categorization.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        items: {
          type: SchemaType.ARRAY,
          description: 'The list of grocery items to add.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING, description: 'Item name (e.g. Sourdough Bread, Organic Whole Milk, Honeycrisp Apples)' },
              category: {
                type: SchemaType.STRING,
                description: 'Aisle/department: Produce, Bakery & Bread, Deli & Prepared, Meat & Seafood, Dairy & Eggs, Pantry & Dry Goods, Snacks & Sweets, Frozen, Beverages, Household & Cleaning, Personal Care & Pharmacy, Pet Care, Other',
              },
              quantity: { type: SchemaType.STRING, description: 'Quantity or count (e.g. 2, 1 lb, 1 bag, 1 gallon)' },
              note: { type: SchemaType.STRING, description: 'Optional detail (e.g. ripe, unsalted, gluten-free)' },
            },
            required: ['name'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'add_calendar_events',
    description: 'Schedule one or more family calendar events with date, time, category, and assigned family members.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        events: {
          type: SchemaType.ARRAY,
          description: 'Calendar events to create.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING, description: 'Event title (e.g. Soccer Practice, Dentist Appointment, Emma\'s Birthday Party)' },
              date: { type: SchemaType.STRING, description: 'Date in YYYY-MM-DD format' },
              startTime: { type: SchemaType.STRING, description: 'Start time in 24-hour HH:mm format (e.g. 16:30, 09:00)' },
              endTime: { type: SchemaType.STRING, description: 'End time in 24-hour HH:mm format' },
              category: {
                type: SchemaType.STRING,
                description: 'Category: Sports, School, Work, Appointment, Family, Celebration',
              },
              assignedMemberName: { type: SchemaType.STRING, description: 'Name of the family member' },
              location: { type: SchemaType.STRING, description: 'Location' },
              description: { type: SchemaType.STRING, description: 'Notes' },
            },
            required: ['title', 'date'],
          },
        },
      },
      required: ['events'],
    },
  },
  {
    name: 'create_meal_plan',
    description: 'Assign meals to specific days in the weekly meal planner and optionally add ingredients to grocery list.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        meals: {
          type: SchemaType.ARRAY,
          description: 'Meals to schedule.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              date: { type: SchemaType.STRING, description: 'Date in YYYY-MM-DD format' },
              mealType: {
                type: SchemaType.STRING,
                description: 'Meal slot: breakfast, lunch, dinner, snack',
              },
              title: { type: SchemaType.STRING, description: 'Meal or dish name' },
              notes: { type: SchemaType.STRING, description: 'Brief description' },
              addIngredientsToGrocery: { type: SchemaType.BOOLEAN, description: 'Whether to add ingredients to grocery list' },
              ingredients: {
                type: SchemaType.ARRAY,
                description: 'List of ingredients needed',
                items: { type: SchemaType.STRING },
              },
            },
            required: ['date', 'mealType', 'title'],
          },
        },
      },
      required: ['meals'],
    },
  },
  {
    name: 'create_custom_list',
    description: 'Create a custom checklist like a Camping Packing List, Chores, or School Supplies.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: 'List title' },
        type: { type: SchemaType.STRING, description: 'List type: packing, todo, checklist' },
        icon: { type: SchemaType.STRING, description: 'Emoji icon' },
        color: { type: SchemaType.STRING, description: 'Hex color string' },
        items: {
          type: SchemaType.ARRAY,
          description: 'Checklist item names',
          items: { type: SchemaType.STRING },
        },
      },
      required: ['name', 'items'],
    },
  },
  {
    name: 'import_recipe_from_url',
    description: 'Import a recipe from a web link / URL.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: { type: SchemaType.STRING, description: 'The recipe website URL' },
      },
      required: ['url'],
    },
  },
];

export function getGeminiModel(apiKey?: string) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is not configured. Please add it in Settings or set GEMINI_API_KEY.');
  }

  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    systemInstruction: ASSISTANT_SYSTEM_PROMPT,
    tools: [{ functionDeclarations: ASSISTANT_TOOLS }],
  });
}

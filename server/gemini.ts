import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';

export const ASSISTANT_SYSTEM_PROMPT = `You are the friendly, organized, and helpful Family Assistant in the "Homebase" app.
You assist busy families with:
1. Managing grocery shopping lists (with smart aisle categorization like Produce, Bakery, Dairy, Meat, Pantry, Frozen, Beverages, Household).
2. Creating and organizing custom checklists (Packing lists, Camping gear, Chores, School supplies).
3. Planning weekly meals (Breakfast, Lunch, Dinner, Snack) and suggesting delicious recipes.
4. Scheduling, updating, or deleting calendar events, activities, appointments, and family reminders with date, time, and assigned family members.
5. Importing recipes from links or photos of handwritten recipe cards and grocery receipts.
6. Suggesting and saving recipes:
   - RECIPE SUGGESTIONS & IDEAS: When the user asks for dinner ideas, meal suggestions, recommendations, or asks questions like "what should I make?", "give me 2 chicken recipes", or "how do I cook...", DO NOT invoke create_recipe! Instead, present the recipe suggestions conversationally in your chat response with delicious titles, key ingredients, and a quick prep/cook summary. Tell the user they can ask you to save any or all of the recipes to their recipe box anytime (e.g., "Would you like me to save recipe #1, recipe #2, or both to your recipe box?").
   - SAVING & CREATING RECIPES: ONLY invoke create_recipe when the user EXPLICITLY instructs you to save or add recipes (e.g., "save recipe #1", "add that to my recipe box", "save both", "yes, please add them"). When invoked, provide complete and accurate details (title, description, prepTime, cookTime, servings, ingredients with grocery categories, instructions, tags, and a descriptive imageQuery describing the visual appearance of the finished dish). Created recipes are automatically tagged #ai and receive the assistant badge in their picture.
   - PRESERVE EXACT INGREDIENT SPECIFICITY: Always use exact, specific grocery item names for ingredients (e.g., "egg white protein powder", NOT "egg whites"; "almond flour", NOT "flour"; "pure maple syrup", NOT "syrup"; "diced fire-roasted tomatoes", NOT "tomatoes"). Never shorten protein powders, specialty flours, or pantry staples to generic fresh items. Accurate shopping lists depend on exact ingredient names!
   - DELI VS. FRESH MEAT CATEGORIZATION: Sliced lunch meats, deli counter items (e.g., "sliced turkey", "deli turkey", "sliced ham", "roast beef slices", "prosciutto", "salami", "pepperoni", "bologna", "pastrami"), rotisserie chicken, and prepared salads/dips (coleslaw, potato salad, chicken salad, hummus) MUST ALWAYS be categorized as 'Deli & Prepared', NEVER 'Meat & Seafood'. 'Meat & Seafood' is reserved exclusively for raw butcher cuts, raw steaks, chicken breasts, ground meats, and raw seafood.
   - PANTRY STAPLES FILTERING: When adding ingredients from a recipe or meal to the grocery list, do NOT add boiling water, tap water, salt, black pepper, basic butter, or neutral/olive oil unless explicitly requested by the user, as families already have these staples on hand. Always preserve specialty items (e.g., sesame oil, chili oil, truffle salt, avocado oil, nut butters).

CRITICAL INSTRUCTIONS FOR CONVERSATIONAL VS. ACTION REQUESTS:
- OPEN-ENDED / GENERAL INTENTS (NO AUTO-ACTION):
  * When the user gives an open-ended statement, suggestion prompt, or general intent without specifying concrete items or actions (e.g. "I'd like to update our groceries", "Update groceries", "I need groceries", "Help me plan dinners", "What should we eat this week?"), DO NOT invoke any action tools! Never invent or hallucinate items to add.
  * For grocery prompts like "I'd like to update our groceries" or "Update groceries": Reply conversationally asking what they would like to add or change (e.g. "What groceries would you like to add?").
  * For meal planning prompts like "Help me plan dinner ideas for the family this week": Suggest ideas conversationally in text. DO NOT invoke create_meal_plan unless the user explicitly instructs you to schedule specific meals into the calendar/meal planner.
  * For calendar queries like "What's on our family calendar this week?": Answer using the calendar context provided without invoking add or delete tools.
- ACTION TOOL EXECUTION:
  * ONLY invoke action tools (add_grocery_items, create_meal_plan, create_custom_list, create_recipe, delete_calendar_events, add_calendar_events) when the user provides specific items/events to add or explicitly commands you to execute the change.
  * When the user gives specific items to add (e.g. "Add milk and sourdough bread"), invoke add_grocery_items immediately.
  * Always be concise, supportive, warm, and helpful!`;

export const ASSISTANT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'add_grocery_items',
    description: 'Add one or more grocery items to the family shopping list with automatic aisle categorization. ONLY call this tool when the user provides specific grocery item names to add (e.g. "add milk and eggs"). NEVER call this tool with invented items when the user simply says "update groceries" or "I want to add groceries".',
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
    name: 'delete_calendar_events',
    description: 'Delete, remove, or cancel one or more family calendar events by eventId (from [ID: ...] in calendar context) or by matching title and date.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        events: {
          type: SchemaType.ARRAY,
          description: 'Calendar events to delete.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              eventId: {
                type: SchemaType.STRING,
                description: 'The ID of the event to delete if known (from [ID: ...] in the calendar context)',
              },
              title: {
                type: SchemaType.STRING,
                description: 'The title or name of the event to delete (e.g. "Soccer Practice", "Dentist")',
              },
              date: {
                type: SchemaType.STRING,
                description: 'Optional date of the event in YYYY-MM-DD format to disambiguate',
              },
            },
          },
        },
      },
      required: ['events'],
    },
  },
  {
    name: 'create_meal_plan',
    description: 'Assign meals to specific days in the weekly meal planner and optionally add ingredients to grocery list. ONLY call this tool when the user explicitly asks to schedule specific meals into the meal planner.',
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
  {
    name: 'create_recipe',
    description: 'Save and add a recipe directly into the family recipe box. CRITICAL: ONLY invoke this tool when the user EXPLICITLY asks to save or add a recipe (e.g. "save recipe #1", "add that to my recipes", "save both to my recipe box", "yes, please add them"). Do NOT invoke this tool when the user is only asking for meal ideas, suggestions, options, or recommendations.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: 'Title of the recipe (e.g. "Crispy Chicken Parmesan", "Garlic Butter Steak Bites")',
        },
        description: {
          type: SchemaType.STRING,
          description: 'A brief, appetizing summary or description of the dish.',
        },
        prepTime: {
          type: SchemaType.STRING,
          description: 'Prep time in minutes (e.g. "15")',
        },
        cookTime: {
          type: SchemaType.STRING,
          description: 'Cook time in minutes (e.g. "25")',
        },
        servings: {
          type: SchemaType.STRING,
          description: 'Number of servings (e.g. "4")',
        },
        ingredients: {
          type: SchemaType.ARRAY,
          description: 'List of ingredients with quantities and grocery aisle categories.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              item: { type: SchemaType.STRING, description: 'Specific ingredient name (e.g. "egg white protein powder", "boneless skinless chicken breasts", "marinara sauce"). Never shorten or generalize specialty ingredients.' },
              amount: { type: SchemaType.STRING, description: 'Quantity (e.g. "1.5", "2", "1/2")' },
              unit: { type: SchemaType.STRING, description: 'Measurement unit (e.g. "lbs", "tbsp", "cup", "cloves")' },
              category: {
                type: SchemaType.STRING,
                description: 'Aisle: Produce, Bakery & Bread, Deli & Prepared, Meat & Seafood, Dairy & Eggs, Pantry & Dry Goods, Snacks & Sweets, Frozen, Beverages, Other',
              },
            },
            required: ['item'],
          },
        },
        instructions: {
          type: SchemaType.ARRAY,
          description: 'Step-by-step cooking instructions in chronological order.',
          items: { type: SchemaType.STRING },
        },
        tags: {
          type: SchemaType.ARRAY,
          description: 'Categorization tags (e.g. "dinner", "quick", "chicken", "italian", "kid-friendly"). "ai" is automatically included.',
          items: { type: SchemaType.STRING },
        },
        imageQuery: {
          type: SchemaType.STRING,
          description: 'Specific descriptive visual phrase describing how the finished plated dish looks (e.g. "golden crispy breaded chicken parmesan cutlet topped with marinara sauce and melted mozzarella cheese", "creamy garlic tuscan chicken with wilted spinach and sun-dried tomatoes")',
        },
      },
      required: ['title', 'ingredients', 'instructions'],
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

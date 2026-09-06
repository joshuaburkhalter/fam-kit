import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';

export const ASSISTANT_SYSTEM_PROMPT = `You are the friendly, organized, and helpful Family Assistant in the "fam-kit" app.
You assist busy families with:
1. Managing grocery lists (with smart aisle categorization like Produce, Dairy, Meat, Pantry, Bakery, Frozen, Beverages, Household).
2. Creating and organizing custom checklists (Packing lists, Camping gear, Chores, School supplies).
3. Planning weekly meals (Breakfast, Lunch, Dinner, Snack) and suggesting delicious recipes tailored to available ingredients or preferences.
4. Scheduling calendar events, activities, appointments, and family reminders with date, time, and assigned family members.
5. Importing recipes from links or photos of handwritten recipe cards and grocery receipts.

Always be concise, supportive, warm, and proactive! When the user asks you to add items, schedule events, or plan meals, invoke the corresponding tool functions immediately. If the user mentions multiple actions at once (e.g. "Add milk to grocery list and put soccer on Thursday at 5pm"), execute ALL matching tools.`;

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
                description: 'Aisle/department: Produce, Dairy & Eggs, Meat & Seafood, Bakery, Pantry & Dry Goods, Frozen, Snacks & Sweets, Beverages, Deli, Household & Cleaning, Personal Care, Baby, Pet, Other',
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
              date: { type: SchemaType.STRING, description: 'Date in YYYY-MM-DD format (if relative e.g. "tomorrow" or "this Thursday", calculate based on current date)' },
              startTime: { type: SchemaType.STRING, description: 'Start time in 24-hour HH:mm format (e.g. 16:30, 09:00)' },
              endTime: { type: SchemaType.STRING, description: 'End time in 24-hour HH:mm format (optional)' },
              category: {
                type: SchemaType.STRING,
                description: 'Category: Sports, School, Work, Appointment, Family, Celebration',
              },
              assignedMemberName: { type: SchemaType.STRING, description: 'Name of the family member this event is for (e.g. Dad, Mom, Leo, Emma)' },
              location: { type: SchemaType.STRING, description: 'Location or address if specified' },
              description: { type: SchemaType.STRING, description: 'Notes or details' },
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
              title: { type: SchemaType.STRING, description: 'Meal or dish name (e.g. Sheet Pan Lemon Herb Chicken with Asparagus)' },
              notes: { type: SchemaType.STRING, description: 'Brief description or serving note' },
              addIngredientsToGrocery: { type: SchemaType.BOOLEAN, description: 'Whether to also automatically add ingredients to grocery list' },
              ingredients: {
                type: SchemaType.ARRAY,
                description: 'List of ingredients needed for this meal',
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
        name: { type: SchemaType.STRING, description: 'List title (e.g. Summer Road Trip Packing List)' },
        type: { type: SchemaType.STRING, description: 'List type: packing, todo, checklist' },
        icon: { type: SchemaType.STRING, description: 'Emoji icon for the list (e.g. 🎒, ⛺, 🧹, ✏️)' },
        color: { type: SchemaType.STRING, description: 'Hex color string (e.g. #6366f1, #10b981, #f59e0b)' },
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
    description: 'Import a recipe from a web link / URL that the user shared.',
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

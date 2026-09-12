import { queryAll } from './db.js';

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  color: string;
}

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  sourceUrl: string | null;
  ingredients: string;
  instructions: string;
  tags: string | null;
}

interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  location: string | null;
  assignedMemberId: string | null;
}

interface MealPlanRow {
  id: string;
  date: string;
  mealType: string;
  title: string;
  notes: string | null;
}

interface GroceryItemRow {
  id: string;
  name: string;
  category: string;
  quantity: string | null;
  unit: string | null;
  note: string | null;
}

interface CustomListRow {
  id: string;
  name: string;
  type: string;
  icon: string;
}

function formatRecipeFull(r: RecipeRow): string {
  let ingStr = '';
  try {
    const ings = JSON.parse(r.ingredients);
    if (Array.isArray(ings)) {
      ingStr = ings
        .map((i: any) => {
          if (typeof i === 'string') return `  - ${i}`;
          if (i && typeof i === 'object') {
            if (i.item) return `  - ${i.item}${i.category ? ` (${i.category})` : ''}`;
            const parts = [i.amount, i.unit, i.name].filter(Boolean).join(' ');
            return `  - ${parts || JSON.stringify(i)}`;
          }
          return `  - ${String(i)}`;
        })
        .join('\n');
    } else {
      ingStr = `  - ${r.ingredients}`;
    }
  } catch {
    ingStr = `  - ${r.ingredients}`;
  }

  let instStr = '';
  try {
    const insts = JSON.parse(r.instructions);
    if (Array.isArray(insts)) {
      instStr = insts
        .map((step: any, idx: number) => {
          if (typeof step === 'string') return `  ${idx + 1}. ${step}`;
          if (step && typeof step === 'object') return `  ${idx + 1}. ${step.text || JSON.stringify(step)}`;
          return `  ${idx + 1}. ${String(step)}`;
        })
        .join('\n');
    } else {
      instStr = `  ${r.instructions}`;
    }
  } catch {
    instStr = `  ${r.instructions}`;
  }

  return `Recipe: "${r.title}"
  - Prep Time: ${r.prepTime || 'N/A'} | Cook Time: ${r.cookTime || 'N/A'} | Servings: ${r.servings || 'N/A'}
  - Tags: ${r.tags || 'General'}
  ${r.description ? `- Description: ${r.description}\n  ` : ''}Ingredients:
${ingStr}
  Instructions:
${instStr}`;
}

function formatRecipeSummary(r: RecipeRow): string {
  return `- "${r.title}" (${r.tags || 'General'} | Prep: ${r.prepTime || 'N/A'}, Cook: ${r.cookTime || 'N/A'}, Servings: ${r.servings || 'N/A'})${r.description ? `\n  Description: ${r.description}` : ''}`;
}

export function buildSelectiveAssistantContext(
  householdId: string,
  promptText: string,
  clientDate?: string,
  clientDayName?: string,
  clientTime?: string,
  timezone?: string
): {
  contextString: string;
  domainsIncluded: string[];
} {
  const p = (promptText || '').toLowerCase();
  const domainsIncluded: string[] = [];
  const contextBlocks: string[] = [];

  // 1. Base Family Context
  const members = queryAll<FamilyMember>(
    'SELECT id, name, role, color FROM users WHERE householdId = ?',
    [householdId]
  );
  const memberNames = members.map((m) => `${m.name} (${m.role})`).join(', ');
  const now = new Date();
  const currentDate = clientDate || now.toLocaleDateString('en-CA');
  const currentDayName = clientDayName || now.toLocaleDateString('en-US', { weekday: 'long' });
  const timeInfo = clientTime ? ` at ${clientTime}` : '';
  const tzInfo = timezone ? ` (${timezone})` : '';

  contextBlocks.push(
    `[Household Info]\n- Current Date & Time: ${currentDayName}, ${currentDate}${timeInfo}${tzInfo}\n- Family Members: ${memberNames || 'Joshua (Parent)'}`
  );

  // 2. Calendar / Schedule Intent
  const calendarKeywords = [
    'calendar', 'schedule', 'scheduled', 'agenda', 'event', 'events',
    'appointment', 'appointments', 'practice', 'busy', 'free time',
    'plans for', 'plans today', 'plans tomorrow', 'plans this week',
    "what's on the calendar", "what is on the calendar",
    "what's on the schedule", "what is on the schedule",
    "what's on today", "what's on tomorrow", "what is on today", "what is on tomorrow",
    'what are we doing today', 'what are we doing tomorrow', 'what are we doing this week',
    'happening today', 'happening tomorrow', 'happening this week',
    'activities today', 'activities tomorrow', 'game tonight', 'dentist', 'doctor',
    'free today', 'free tomorrow', 'busy today', 'busy tomorrow',
    'cancel', 'delete', 'remove', 'reschedule', 'drop'
  ];

  const temporalWords = [
    'today', 'tomorrow', 'tonight', 'this week', 'next week', 'this weekend',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];

  // Check if prompt asks what a specific family member has going on (e.g. "What is Emma doing tomorrow?")
  const mentionsMember = members.some((m) => p.includes(m.name.toLowerCase()));
  const hasTemporal = temporalWords.some((tw) => p.includes(tw));
  const hasActionInquiry = p.includes('doing') || p.includes('have on') || p.includes('have going') || p.includes('up to');

  const wantsCalendar =
    calendarKeywords.some((kw) => p.includes(kw)) ||
    (mentionsMember && hasTemporal && (hasActionInquiry || p.includes('what')));

  if (wantsCalendar) {
    domainsIncluded.push('calendar');
    const events = queryAll<CalendarEventRow>(
      `SELECT id, title, description, date, startTime, endTime, category, location, assignedMemberId
       FROM calendar_events
       WHERE householdId = ? AND date >= date('now', '-1 day')
       ORDER BY date ASC, startTime ASC LIMIT 30`,
      [householdId]
    );

    if (events.length === 0) {
      contextBlocks.push(`[Family Calendar]\nNo events scheduled for the next 30 days.`);
    } else {
      const memberMap = new Map(members.map((m) => [m.id, m.name]));
      const lines = events.map((e) => {
        const timeStr = e.startTime
          ? e.endTime
            ? `${e.startTime}-${e.endTime}`
            : e.startTime
          : 'All Day';
        const assignedName = e.assignedMemberId && memberMap.has(e.assignedMemberId)
          ? ` (For: ${memberMap.get(e.assignedMemberId)})`
          : '';
        const locStr = e.location ? ` @ ${e.location}` : '';
        const descStr = e.description ? ` [${e.description}]` : '';
        return `- [ID: ${e.id}] ${e.date} [${timeStr}]: ${e.title}${assignedName}${locStr}${descStr}`;
      });
      contextBlocks.push(`[Family Calendar - Upcoming Events]\n${lines.join('\n')}`);
    }
  }

  // 3. Recipes Intent
  const recipeKeywords = [
    'recipe', 'recipes', 'cookbook', 'cook', 'bake', 'dish', 'dishes',
    'how to make', 'how do i make', 'how do we make', 'ingredients for',
    'instructions for', 'steps for', 'what can we make', 'recipe for',
    'several recipes', 'all recipes', 'all the recipes'
  ];

  const allRecipes = queryAll<RecipeRow>(
    `SELECT id, title, description, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags
     FROM recipes
     WHERE householdId = ?`,
    [householdId]
  );

  // Check if specific recipe title or keywords match
  const matchedSpecificRecipes: RecipeRow[] = [];
  for (const r of allRecipes) {
    const titleLower = r.title.toLowerCase();
    // Direct title inclusion
    if (p.includes(titleLower)) {
      matchedSpecificRecipes.push(r);
      continue;
    }
    // Check significant words (length >= 4, excluding generic cooking words)
    const significantWords = titleLower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !['easy', 'best', 'with', 'from', 'style', 'homemade', 'sheet', 'quick', 'dish', 'recipe'].includes(w));

    if (significantWords.some((w) => p.includes(w))) {
      matchedSpecificRecipes.push(r);
    }
  }

  const mentionsRecipeGenerally = recipeKeywords.some((kw) => p.includes(kw));

  if (matchedSpecificRecipes.length > 0 && matchedSpecificRecipes.length <= 3 && !p.includes('all recipes') && !p.includes('several recipes')) {
    // Specific recipe(s) matched!
    domainsIncluded.push(`recipe:${matchedSpecificRecipes.map((r) => r.title).join(',')}`);
    const details = matchedSpecificRecipes.map(formatRecipeFull).join('\n\n');
    contextBlocks.push(`[Specific Saved Recipe Details]\n${details}`);
  } else if (mentionsRecipeGenerally || matchedSpecificRecipes.length > 0) {
    // General recipe request or asking about multiple/all recipes
    domainsIncluded.push('recipes-catalog');
    if (allRecipes.length === 0) {
      contextBlocks.push(`[Saved Recipes Catalog]\nNo recipes currently saved in the cookbook.`);
    } else {
      // Check if user specifically requested full details / instructions for all / several
      const wantsAllDetails = p.includes('full details') || p.includes('instructions for all') || p.includes('ingredients for all');
      if (wantsAllDetails && allRecipes.length <= 6) {
        const fullDetails = allRecipes.map(formatRecipeFull).join('\n\n');
        contextBlocks.push(`[All Saved Recipes - Full Details]\n${fullDetails}`);
      } else {
        const summaries = allRecipes.map(formatRecipeSummary).join('\n');
        contextBlocks.push(
          `[Saved Recipes Catalog (${allRecipes.length} recipes in library)]\n${summaries}\n(Note: Full ingredients and instructions are available upon request for any of these recipes)`
        );
      }
    }
  }

  // 4. Meal Plan Intent
  const mealPlanKeywords = [
    'meal plan', 'meal planning', 'meals for the week', "what's for dinner",
    'what are we having for dinner', 'dinner tonight', 'dinner tomorrow',
    'breakfast tomorrow', 'breakfast today', 'lunch today', 'lunch tomorrow',
    'what are we eating', 'menu for the week', 'planned meals', 'dinner this week',
    'what meal', 'planned for dinner', 'cooking log', 'what did we make', 'what was made',
    'what did we eat'
  ];

  const wantsMealPlan = mealPlanKeywords.some((kw) => p.includes(kw));
  if (wantsMealPlan) {
    domainsIncluded.push('meal_plans');

    // Check weekly_meals (unallocated weekly pool)
    const weeklyMeals = queryAll<{ id: string; title: string; isMade: number; madeDate: string | null }>(
      `SELECT id, title, isMade, madeDate FROM weekly_meals WHERE householdId = ? ORDER BY createdAt DESC LIMIT 15`,
      [householdId]
    );

    // Check meal_logs (what was made on which day)
    const recentLogs = queryAll<{ title: string; date: string; notes: string | null }>(
      `SELECT title, date, notes FROM meal_logs WHERE householdId = ? ORDER BY date DESC, createdAt DESC LIMIT 10`,
      [householdId]
    );

    const mealBlocks: string[] = [];

    if (weeklyMeals.length > 0) {
      const weekLines = weeklyMeals.map((wm) =>
        `- ${wm.title} [${wm.isMade ? `Made on ${wm.madeDate || 'recently'}` : 'To Cook this week'}]`
      );
      mealBlocks.push(`[This Week's Planned Meals (Unallocated Pool)]\n${weekLines.join('\n')}`);
    }

    if (recentLogs.length > 0) {
      const logLines = recentLogs.map((ml) =>
        `- ${ml.date}: ${ml.title}${ml.notes ? ` (${ml.notes})` : ''}`
      );
      mealBlocks.push(`[Recent Cooking Log (What was made which day)]\n${logLines.join('\n')}`);
    }

    if (mealBlocks.length === 0) {
      contextBlocks.push(`[Weekly Meals & Cooking Log]\nNo meals currently planned for this week or logged.`);
    } else {
      contextBlocks.push(mealBlocks.join('\n\n'));
    }
  }

  // 5. Grocery Shopping List Intent
  const groceryKeywords = [
    'grocery', 'groceries', 'shopping list', 'need to buy', 'buy at the store',
    'on the list', 'on our list', 'out of', 'what do we need', 'grocery items',
    'shopping items', 'grocery cart', 'add to the list', 'add to grocery'
  ];

  const wantsGrocery = groceryKeywords.some((kw) => p.includes(kw));
  if (wantsGrocery) {
    domainsIncluded.push('groceries');
    const items = queryAll<GroceryItemRow>(
      `SELECT id, name, category, quantity, unit, note
       FROM grocery_items
       WHERE householdId = ? AND checked = 0 AND (listId IS NULL OR listId = '')
       ORDER BY category ASC, name ASC LIMIT 60`,
      [householdId]
    );

    if (items.length === 0) {
      contextBlocks.push(`[Current Active Grocery Shopping List]\nThe grocery shopping list is currently empty.`);
    } else {
      // Group by category
      const byCategory: { [cat: string]: string[] } = {};
      for (const item of items) {
        const cat = item.category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = [];
        const qtyStr = item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : '';
        const noteStr = item.note ? ` [Note: ${item.note}]` : '';
        byCategory[cat].push(`${item.name}${qtyStr}${noteStr}`);
      }

      const categoryLines = Object.entries(byCategory).map(
        ([cat, itemList]) => `- ${cat}: ${itemList.join(', ')}`
      );
      contextBlocks.push(`[Current Active Grocery Shopping List (${items.length} items)]\n${categoryLines.join('\n')}`);
    }
  }

  // 6. Custom Checklist Intent (Camping, Packing, Chores, School)
  const listKeywords = [
    'packing list', 'camping list', 'camping', 'checklist', 'packing',
    'chore', 'chores', 'school supplies', 'custom list', 'gear list'
  ];

  const wantsCustomList = listKeywords.some((kw) => p.includes(kw));
  if (wantsCustomList) {
    domainsIncluded.push('custom_lists');
    const customLists = queryAll<CustomListRow>(
      `SELECT id, name, type, icon FROM custom_lists WHERE householdId = ?`,
      [householdId]
    );

    if (customLists.length > 0) {
      const listSummaries: string[] = [];
      for (const cl of customLists) {
        const clItems = queryAll<{ name: string; quantity: string | null; checked: number }>(
          `SELECT name, quantity, checked FROM grocery_items WHERE listId = ? AND householdId = ?`,
          [cl.id, householdId]
        );
        const itemNames = clItems.map((ci) => `${ci.checked ? '✓ ' : ''}${ci.name}${ci.quantity ? ` (${ci.quantity})` : ''}`);
        listSummaries.push(
          `- ${cl.icon} ${cl.name} (${cl.type}):\n  ${itemNames.length > 0 ? itemNames.join(', ') : 'Empty list'}`
        );
      }
      contextBlocks.push(`[Custom Family Lists]\n${listSummaries.join('\n')}`);
    }
  }

  return {
    contextString: '\n' + contextBlocks.join('\n\n'),
    domainsIncluded,
  };
}

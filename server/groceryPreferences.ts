import { queryAll, queryOne, execute, saveDb } from './db';

export interface AisleRef {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface GrocerySuggestion {
  name: string;
  aisleId: string;
  category: string;
  quantity?: string;
  unit?: string;
}

/**
 * Normalizes a grocery item name into a clean key for indexing and matching.
 * Strips quantities, units, preparation terms, and common filler words.
 */
export function normalizeItemKey(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/^[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+(?:to\s+[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+)?/i, '')
    .replace(
      /\b(?:cups?|c|tablespoons?|tbsp?|teaspoons?|tsp?|pounds?|lbs?|ounces?|oz|grams?|g|kg|ml|liters?|pinches?|cloves?|stalks?|bunches?|cans?|bottles?|packages?|pkgs?|slices?|pieces?|cartons?|bags?|containers?|boxes?)\b/gi,
      ''
    )
    .replace(/\([^)]*\)/g, '')
    .replace(
      /\b(?:divided|optional|to taste|for serving|freshly|grated|chopped|sliced|diced|minced|cubed|crushed|plus more as needed|organic|fresh)\b/gi,
      ''
    )
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basic plural normalization (e.g., 'bananas' -> 'banana', 'strawberries' -> 'strawberry')
 */
export function stemItemKey(term: string): string {
  let s = term.toLowerCase().trim();
  if (s.endsWith('ies') && s.length > 4) {
    return s.slice(0, -3) + 'y';
  }
  if (s.endsWith('es') && s.length > 3 && !s.endsWith('cheese')) {
    return s.slice(0, -2);
  }
  if (s.endsWith('s') && s.length > 2 && !s.endsWith('ss')) {
    return s.slice(0, -1);
  }
  return s;
}

/**
 * Standard rule-based category guessing based on food terms.
 */
export function guessAisleForGroceryItem(
  rawName: string,
  aisles: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const clean = normalizeItemKey(rawName);
  const lower = rawName.toLowerCase();

  const findAisle = (regex: RegExp) => aisles.find((a) => regex.test(a.name));

  // 1. Specific compound checks first
  if (/\b(?:peanut|almond|cashew|sunflower|nut)\s*butter\b/i.test(lower)) {
    return findAisle(/pantry/i) || null;
  }
  if (/\b(?:chile|chili|curry|garlic|onion)\s*powder\b/i.test(lower)) {
    return findAisle(/pantry/i) || null;
  }
  if (/\b(?:protein powder|egg white powder|whey|collagen|creatine|matcha|protein)\b/i.test(lower)) {
    return findAisle(/pantry/i) || findAisle(/health/i) || findAisle(/other/i) || null;
  }
  if (/\b(?:coconut|almond|oat|soy)\s*milk\b/i.test(lower)) {
    return findAisle(/dairy/i) || findAisle(/pantry/i) || null;
  }
  if (/\b(?:naan|tortilla|pita|bread|bun|roll|bagel|baguette|croissant|crust)\b/i.test(clean)) {
    return findAisle(/bakery|bread/i) || null;
  }

  // 2. Deli & Prepared (sliced lunch meats, deli counter meats, rotisserie chicken, prepared salads & dips)
  if (
    /\b(?:deli|lunch\s*meat|lunchmeat|cold\s*cuts?|prosciutto|salami|pepperoni|bologna|pastrami|capicola|pancetta|mortadella)\b/i.test(lower) ||
    (/\b(?:sliced|shaved|deli)\b/i.test(lower) && /\b(?:turkey|chicken|ham|roast\s*beef|beef|pastrami)\b/i.test(lower) && !/\b(?:ground|raw|whole)\b/i.test(lower)) ||
    /\b(?:turkey|chicken|ham|beef|roast\s*beef)\s+(?:slices?|cold\s*cuts?|lunch\s*meat)\b/i.test(lower) ||
    /\b(?:rotisserie\s*chicken|potato\s*salad|macaroni\s*salad|coleslaw|chicken\s*salad|egg\s*salad|tuna\s*salad|hummus|tzatziki)\b/i.test(lower)
  ) {
    return findAisle(/deli|prepared/i) || findAisle(/meat|seafood/i) || null;
  }

  // 3. Meat & Seafood
  if (/\b(?:chicken|beef|pork|steak|bacon|turkey|salmon|fish|shrimp|sausage|lamb|tuna|meat|prawns?|scallops?|halibut|cod|tilapia|ribs?|ground beef|ground turkey)\b/i.test(clean)) {
    return findAisle(/meat|seafood/i) || null;
  }

  // 4. Dairy & Eggs
  if (/\b(?:paneer|milk|yogurt|yoghurt|cheese|butter|cream|eggs?|mozzarella|cheddar|parmesan|feta|ricotta|provolone|curd|sour cream)\b/i.test(clean)) {
    return findAisle(/dairy/i) || null;
  }

  // 5. Produce (fresh fruits, vegetables, fresh herbs)
  if (/\b(?:cilantro|mint|onion|onions|garlic|chile|chiles|chili|chilies|peppers?|lemons?|limes?|ginger|herbs?|spinach|lettuce|apples?|bananas?|potatoes?|avocados?|carrots?|basil|tomatoes?|shallots?|kale|scallions?|berries|strawberries|blueberries|mushrooms?|cucumbers?|parsley|rosemary|thyme|zucchini|cabbage|cauliflower|broccoli|celery|asparagus|corn|peas)\b/i.test(clean)) {
    return findAisle(/produce/i) || null;
  }

  // 6. Frozen
  if (/\b(?:frozen|ice cream|gelato|popsicle|popsicles)\b/i.test(lower)) {
    return findAisle(/frozen/i) || null;
  }

  // 7. Beverages (strict word boundaries so "tea" doesn't match "teaspoon")
  if (/\b(?:juice|coffee|tea|soda|wine|beer|seltzer|cider|cola|lemonade|beverage)\b/i.test(clean)) {
    return findAisle(/beverage|drink/i) || null;
  }

  // 8. Snacks & Sweets
  if (/\b(?:chips?|crackers?|chocolate|cookies?|candy|popcorn|pretzels?|nuts?|cashews?|almonds?|peanuts?|walnuts?)\b/i.test(clean)) {
    return findAisle(/snack|sweet/i) || null;
  }

  // 9. Pantry & Dry Goods
  if (
    /\b(?:rice|pasta|noodles?|oil|ghee|salt|sea salt|seeds?|cumin|spices?|seasoning|flour|sugar|broth|stock|sauce|soy sauce|vinegar|beans?|can|canned|extract|honey|syrup|vanilla|cinnamon|oregano|curry|water|mustard|ketchup|mayo|mayonnaise|yeast|baking powder|baking soda|oats?|quinoa)\b/i.test(clean) ||
    /\b(?:ghee|oil|salt|seeds?|cumin|powder)\b/i.test(lower)
  ) {
    return findAisle(/pantry/i) || null;
  }

  return findAisle(/pantry/i) || findAisle(/other/i) || aisles[0] || null;
}

/**
 * Saves or updates a household's learned aisle/category preference for an item.
 */
export function saveCategoryPreference(
  householdId: string,
  rawName: string,
  aisleId: string,
  categoryName: string
): void {
  if (!householdId || !rawName || !aisleId) return;

  const normalized = normalizeItemKey(rawName);
  if (!normalized) return;

  const now = new Date().toISOString();
  const id = `pref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  execute(
    `INSERT INTO grocery_category_preferences (id, householdId, normalizedName, rawName, aisleId, category, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(householdId, normalizedName) DO UPDATE SET
       aisleId = excluded.aisleId,
       category = excluded.category,
       rawName = excluded.rawName,
       updatedAt = excluded.updatedAt`,
    [id, householdId, normalized, rawName.trim(), aisleId, categoryName, now]
  );
  saveDb();
}

/**
 * Removes a household's learned aisle/category preference for an item name.
 */
export function deleteCategoryPreference(householdId: string, rawName: string): void {
  if (!householdId || !rawName) return;
  const normalized = normalizeItemKey(rawName);
  if (!normalized) return;

  execute('DELETE FROM grocery_category_preferences WHERE householdId = ? AND (normalizedName = ? OR normalizedName = ?)', [
    householdId,
    normalized,
    stemItemKey(normalized),
  ]);
  saveDb();
}

/**
 * Resolves the appropriate aisle and category for an item by checking:
 * 1. Explicitly provided aisleId (if valid)
 * 2. Household's learned category preference (exact or fuzzy/token match)
 * 3. Static heuristic rule engine (`guessAisleForGroceryItem`)
 * 4. Generic fallback to matching category or default aisle
 */
export function resolveAisleForGroceryItem(
  householdId: string,
  rawName: string,
  aisles: Array<{ id: string; name: string }>,
  preferredCategory?: string,
  preferredAisleId?: string
): { aisleId: string; category: string; source: 'explicit' | 'learned' | 'rule' | 'fallback' } {
  // 1. Explicit aisleId check
  if (preferredAisleId) {
    const matched = aisles.find((a) => a.id === preferredAisleId);
    if (matched) {
      return { aisleId: matched.id, category: matched.name, source: 'explicit' };
    }
  }

  const normalized = normalizeItemKey(rawName);
  const stemmed = stemItemKey(normalized);

  // 2. Check household learned preferences
  if (householdId && normalized) {
    // Exact normalized match
    const exact = queryOne<{ aisleId: string; category: string }>(
      `SELECT aisleId, category FROM grocery_category_preferences 
       WHERE householdId = ? AND (normalizedName = ? OR normalizedName = ?)`,
      [householdId, normalized, stemmed]
    );

    if (exact && aisles.some((a) => a.id === exact.aisleId)) {
      return { aisleId: exact.aisleId, category: exact.category, source: 'learned' };
    }

    // Substring / token matching against household preferences
    const allPrefs = queryAll<{ normalizedName: string; aisleId: string; category: string }>(
      `SELECT normalizedName, aisleId, category FROM grocery_category_preferences 
       WHERE householdId = ?`,
      [householdId]
    );

    // Find the longest matching preference (e.g. "almond milk" in "vanilla almond milk")
    let bestMatch: { aisleId: string; category: string; length: number } | null = null;
    for (const pref of allPrefs) {
      const prefStem = stemItemKey(pref.normalizedName);
      if (
        (normalized.includes(pref.normalizedName) ||
          normalized.includes(prefStem) ||
          pref.normalizedName.includes(normalized) ||
          prefStem.includes(stemmed)) &&
        aisles.some((a) => a.id === pref.aisleId)
      ) {
        if (!bestMatch || pref.normalizedName.length > bestMatch.length) {
          bestMatch = {
            aisleId: pref.aisleId,
            category: pref.category,
            length: pref.normalizedName.length,
          };
        }
      }
    }

    if (bestMatch) {
      return { aisleId: bestMatch.aisleId, category: bestMatch.category, source: 'learned' };
    }
  }

  // 3. Fallback to heuristic rules
  const guessed = guessAisleForGroceryItem(rawName, aisles);
  if (guessed) {
    return { aisleId: guessed.id, category: guessed.name, source: 'rule' };
  }

  // 4. Preferred category or generic fallback
  if (preferredCategory) {
    const matched = aisles.find((a) => a.name.toLowerCase() === preferredCategory.toLowerCase());
    if (matched) {
      return { aisleId: matched.id, category: matched.name, source: 'fallback' };
    }
  }

  const defaultAisle =
    aisles.find((a) => /pantry/i.test(a.name)) ||
    aisles.find((a) => /other/i.test(a.name)) ||
    aisles[0] || { id: 'other', name: 'Other' };

  return { aisleId: defaultAisle.id, category: defaultAisle.name, source: 'fallback' };
}

export function recordGroceryHistoryItem(
  householdId: string,
  name: string,
  aisleId?: string | null,
  category?: string | null,
  source: string = 'grocery'
) {
  if (!householdId || !name || !name.trim()) return;
  const raw = name.trim();
  const normalized = raw.toLowerCase();
  const now = new Date().toISOString();
  try {
    execute(
      `INSERT OR REPLACE INTO grocery_history (householdId, normalizedName, name, aisleId, category, source, lastAddedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [householdId, normalized, raw, aisleId || null, category || null, source, now]
    );
  } catch (err) {
    console.error('Failed to record grocery history:', err);
  }
}

export function extractIngredientName(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const cleaned = trimmed
      .replace(/^[\d\s\/\.\-\u00BC-\u00BE\u2150-\u215E]+(cups?|tbsp?|teaspoons?|tablespoons?|tsps?|oz|ounces?|lbs?|pounds?|grams?|g|kg|cans?|cloves?|slices?|pinch|pkg|package|bunch|stalks?|pieces?)\s*(of\s+)?/i, '')
      .replace(/^[\d\s\/\.\-\u00BC-\u00BE\u2150-\u215E]+\s+/, '')
      .trim();
    return cleaned || trimmed;
  }
  if (typeof raw === 'object') {
    const val = raw.item || raw.name || raw.ingredient || raw.title;
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

/**
 * Returns distinct historical grocery items for autocomplete suggestions.
 * Gathers from grocery items, historical grocery items, recipes, learned preferences, and pantry inventory,
 * resolving each item to its remembered aisle.
 */
export function getHouseholdGrocerySuggestions(
  householdId: string,
  aisles: Array<{ id: string; name: string }>
): GrocerySuggestion[] {
  if (!householdId) return [];

  // Clean up any historical preferences saved from custom lists
  try {
    execute(
      `DELETE FROM grocery_category_preferences 
       WHERE householdId = ? 
         AND aisleId IN (SELECT id FROM aisles WHERE householdId = ? AND listId IS NOT NULL AND listId != 'grocery')`,
      [householdId, householdId]
    );
    execute(
      `DELETE FROM grocery_category_preferences 
       WHERE householdId = ? 
         AND normalizedName IN (
           SELECT LOWER(TRIM(name)) FROM grocery_items 
           WHERE householdId = ? AND listId IS NOT NULL AND listId != 'grocery'
         )
         AND normalizedName NOT IN (
           SELECT LOWER(TRIM(name)) FROM grocery_items 
           WHERE householdId = ? AND (listId IS NULL OR listId = 'grocery')
         )`,
      [householdId, householdId, householdId]
    );
  } catch {}

  const seen = new Set<string>();
  const suggestions: GrocerySuggestion[] = [];

  const addSuggestion = (rawName: string, explicitAisleId?: string, explicitCategory?: string) => {
    const trimmed = rawName?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const resolved = resolveAisleForGroceryItem(
      householdId,
      trimmed,
      aisles,
      explicitCategory,
      explicitAisleId
    );

    suggestions.push({
      name: trimmed,
      aisleId: resolved.aisleId,
      category: resolved.category,
    });
  };

  // 1. Current Grocery Items (currently active on the list)
  const currentRows = queryAll<{ name: string; aisleId?: string; category?: string; count: number }>(
    `SELECT name, aisleId, category, COUNT(*) as count 
     FROM grocery_items 
     WHERE householdId = ? AND (listId IS NULL OR listId = 'grocery')
     GROUP BY LOWER(TRIM(name))
     ORDER BY count DESC, createdAt DESC
     LIMIT 150`,
    [householdId]
  );
  for (const r of currentRows) {
    addSuggestion(r.name, r.aisleId, r.category);
  }

  // 2. Historical Grocery Items (all items previously entered into the grocery list, even if checked/cleared)
  try {
    const historyRows = queryAll<{ name: string; aisleId?: string; category?: string }>(
      `SELECT name, aisleId, category 
       FROM grocery_history 
       WHERE householdId = ? 
       ORDER BY lastAddedAt DESC 
       LIMIT 250`,
      [householdId]
    );
    for (const h of historyRows) {
      addSuggestion(h.name, h.aisleId, h.category);
    }
  } catch {}

  // 3. Recipe Ingredients (all ingredients entered in the household's recipes)
  try {
    const recipeRows = queryAll<{ title: string; ingredients: string }>(
      `SELECT title, ingredients FROM recipes WHERE householdId = ? ORDER BY createdAt DESC`,
      [householdId]
    );
    for (const rec of recipeRows) {
      if (!rec.ingredients) continue;
      let ingList: any[] = [];
      try {
        if (typeof rec.ingredients === 'string') {
          ingList = JSON.parse(rec.ingredients);
        } else if (Array.isArray(rec.ingredients)) {
          ingList = rec.ingredients;
        }
      } catch {}

      if (Array.isArray(ingList)) {
        for (const ing of ingList) {
          const ingName = extractIngredientName(ing);
          const ingCategory = typeof ing === 'object' && ing ? ing.category : undefined;
          if (ingName) {
            addSuggestion(ingName, undefined, ingCategory);
          }
        }
      }
    }
  } catch {}

  // 4. Grocery Category Preferences
  const prefs = queryAll<{ rawName: string; aisleId: string; category: string }>(
    `SELECT rawName, aisleId, category FROM grocery_category_preferences 
     WHERE householdId = ? 
       AND (
         aisleId IN (SELECT id FROM aisles WHERE householdId = ? AND (listId IS NULL OR listId = 'grocery'))
         OR aisleId IS NULL
       )
     ORDER BY updatedAt DESC 
     LIMIT 50`,
    [householdId, householdId]
  );
  for (const p of prefs) {
    addSuggestion(p.rawName, p.aisleId, p.category);
  }

  // 5. Inventory Items (pantry inventory)
  const inventoryRows = queryAll<{ name: string; category?: string }>(
    `SELECT DISTINCT name, category FROM inventory_items 
     WHERE householdId = ? 
     LIMIT 100`,
    [householdId]
  );
  for (const inv of inventoryRows) {
    addSuggestion(inv.name, undefined, inv.category);
  }

  return suggestions;
}

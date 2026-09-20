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

/**
 * Returns distinct historical grocery items for autocomplete suggestions.
 * Gathers from grocery_items, learned preferences, and pantry inventory,
 * resolving each item to its remembered aisle.
 */
export function getHouseholdGrocerySuggestions(
  householdId: string,
  aisles: Array<{ id: string; name: string }>
): GrocerySuggestion[] {
  if (!householdId) return [];

  // Query distinct names and latest/most frequent items
  const rows = queryAll<{ name: string; aisleId?: string; category?: string; count: number }>(
    `SELECT name, aisleId, category, COUNT(*) as count 
     FROM grocery_items 
     WHERE householdId = ? AND (listId IS NULL OR listId = 'grocery')
     GROUP BY LOWER(TRIM(name))
     ORDER BY count DESC, createdAt DESC
     LIMIT 150`,
    [householdId]
  );

  // Also fetch preferences that might not currently be on the list
  const prefs = queryAll<{ rawName: string; aisleId: string; category: string }>(
    `SELECT rawName, aisleId, category FROM grocery_category_preferences 
     WHERE householdId = ? 
     ORDER BY updatedAt DESC 
     LIMIT 50`,
    [householdId]
  );

  // Also include inventory items
  const inventoryRows = queryAll<{ name: string; category?: string }>(
    `SELECT DISTINCT name, category FROM inventory_items 
     WHERE householdId = ? 
     LIMIT 50`,
    [householdId]
  );

  const seen = new Set<string>();
  const suggestions: GrocerySuggestion[] = [];

  // Process grocery items first (highest relevance)
  for (const r of rows) {
    const key = r.name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const resolved = resolveAisleForGroceryItem(
      householdId,
      r.name,
      aisles,
      r.category,
      r.aisleId
    );

    suggestions.push({
      name: r.name.trim(),
      aisleId: resolved.aisleId,
      category: resolved.category,
    });
  }

  // Process learned preferences
  for (const p of prefs) {
    const key = p.rawName.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const resolved = resolveAisleForGroceryItem(
      householdId,
      p.rawName,
      aisles,
      p.category,
      p.aisleId
    );

    suggestions.push({
      name: p.rawName.trim(),
      aisleId: resolved.aisleId,
      category: resolved.category,
    });
  }

  // Process inventory items
  for (const inv of inventoryRows) {
    const key = inv.name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const resolved = resolveAisleForGroceryItem(
      householdId,
      inv.name,
      aisles,
      inv.category
    );

    suggestions.push({
      name: inv.name.trim(),
      aisleId: resolved.aisleId,
      category: resolved.category,
    });
  }

  return suggestions;
}

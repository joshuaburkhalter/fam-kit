/**
 * Utility to identify and auto-filter basic household kitchen staples
 * (like boiling water, salt, black pepper, standard butter, and basic olive/vegetable oil)
 * when exporting or adding recipe ingredients to the grocery shopping list.
 */

function cleanIngredientForStapleCheck(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+(?:to\s+[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+)?/i, '')
    .replace(/\b(?:cups?|c|tablespoons?|tbsp?|teaspoons?|tsp?|pounds?|lbs?|ounces?|oz|grams?|g|kg|ml|liters?|pinches?|cloves?|stalks?|bunches?|cans?|bottles?|packages?|pkgs?|slices?|pieces?)\b/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(?:divided|optional|to\s+taste|for\s+serving|freshly|ground|melted|softened|cold|warm|hot|boiling|lukewarm|tap|filtered|ice|cracked|fine|coarse|pure|neutral)\b/gi, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true if an ingredient is a universal home cooking staple that
 * should not be added to the grocery shopping list (e.g. boiling water, salt, pepper, basic butter, oil).
 */
export function isBasicPantryStaple(rawName: string): boolean {
  const lower = (rawName || '').toLowerCase().trim();
  const clean = cleanIngredientForStapleCheck(rawName);

  if (!lower || !clean) return false;

  // 1. Water:
  // Reject non-staple / specialty waters
  if (/\b(?:sparkling|mineral|coconut|tonic|rose|orange\s+blossom|seltzer)\b/i.test(lower)) {
    return false;
  }
  // Reject foods containing 'water' in their name
  if (/\b(?:watermelon|watercress|water\s*chestnuts?)\b/i.test(lower)) {
    return false;
  }
  if (
    /^(?:[\d\s½⅓⅔¼¾⅛⅜⅝⅞/.,-]+\s*(?:cups?|c|tbsp|tsp|ml|oz|liters?|quarts?|gallons?)\s+)?(?:boiling|warm|hot|cold|tap|ice|lukewarm|filtered|clean)?\s*water$/i.test(lower) ||
    clean === 'water'
  ) {
    return true;
  }

  // 2. Salt & Black Pepper:
  // Reject specialty salts and non-standard peppers (bell, chili, cayenne, etc.)
  if (/\b(?:truffle|garlic|onion|celery|smoked|pink\s+himalayan|himalayan)\s+salt\b/i.test(lower)) {
    return false;
  }
  if (/\b(?:bell|chili|cayenne|jalapeno|serrano|poblano|habanero|white|lemon|peppercorns?|flakes?)\b/i.test(lower)) {
    return false;
  }
  if (/^(?:salt|kosher salt|sea salt|black pepper|pepper|salt and pepper|salt and black pepper)$/i.test(clean)) {
    return true;
  }

  // 3. Basic Butter:
  // Reject nut butters, fruit butters, compound butters, or non-dairy foods
  if (/\b(?:peanut|almond|cashew|sunflower|sun|apple|cookie|truffle|garlic|herb|vegan|butternut|squash|beans?|lettuce)\b/i.test(lower)) {
    return false;
  }
  if (/^(?:butter|unsalted butter|salted butter)$/i.test(clean)) {
    return true;
  }

  // 4. Basic Cooking Oil:
  // Reject specialty culinary oils (sesame, truffle, chili, avocado, coconut, walnut, etc.)
  if (/\b(?:sesame|truffle|chili|avocado|coconut|peanut|grapeseed|walnut|flaxseed)\b/i.test(lower)) {
    return false;
  }
  if (/^(?:cooking oil|vegetable oil|canola oil|olive oil|extra virgin olive oil|oil)$/i.test(clean)) {
    return true;
  }

  return false;
}

export interface FilteredIngredientsResult<T> {
  toAdd: T[];
  skippedStaples: T[];
}

export function filterRecipeIngredientsForGrocery<T extends { item?: string; name?: string }>(
  ingredients: T[]
): FilteredIngredientsResult<T> {
  const toAdd: T[] = [];
  const skippedStaples: T[] = [];

  for (const ing of ingredients) {
    const rawName = ing.item || ing.name || '';
    if (!rawName.trim()) continue;

    if (isBasicPantryStaple(rawName)) {
      skippedStaples.push(ing);
    } else {
      toAdd.push(ing);
    }
  }

  return { toAdd, skippedStaples };
}

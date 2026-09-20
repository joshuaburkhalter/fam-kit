/**
 * Smart Category Shelf-Life Estimation (USDA FoodKeeper Rules)
 * Automatically estimates days until expiration based on food category, item name, and storage location.
 */

export type PantryLocation = 'fridge' | 'freezer' | 'pantry';

interface ShelfLifeRule {
  keywords: RegExp;
  daysByLocation: {
    fridge: number;
    freezer: number;
    pantry: number;
  };
}

const SHELF_LIFE_RULES: ShelfLifeRule[] = [
  // Fresh Seafood
  {
    keywords: /\b(fish|salmon|tuna|shrimp|prawn|tilapia|cod|scallop|crab|lobster|seafood)\b/i,
    daysByLocation: { fridge: 2, freezer: 90, pantry: 1 },
  },
  // Fresh Poultry & Ground Meat
  {
    keywords: /\b(ground beef|ground turkey|chicken|poultry|turkey breast|wings|thighs|drumsticks|pork chop)\b/i,
    daysByLocation: { fridge: 3, freezer: 180, pantry: 1 },
  },
  // Red Meat & Steaks
  {
    keywords: /\b(beef|steak|roast|lamb|veal|pork|ribs)\b/i,
    daysByLocation: { fridge: 4, freezer: 180, pantry: 1 },
  },
  // Deli meats & Bacon
  {
    keywords: /\b(deli|ham|bacon|prosciutto|salami|hot dog|sausage|pepperoni|lunch meat)\b/i,
    daysByLocation: { fridge: 7, freezer: 60, pantry: 1 },
  },
  // Fresh Berries & Soft Fruits
  {
    keywords: /\b(berry|berries|strawberry|strawberries|raspberry|raspberries|blackberry|blackberries|blueberry|blueberries|avocado|banana|figs)\b/i,
    daysByLocation: { fridge: 5, freezer: 180, pantry: 3 },
  },
  // Leafy Greens & Herbs
  {
    keywords: /\b(spinach|lettuce|arugula|kale|cilantro|parsley|basil|mint|dill|herbs|salad green|microgreens)\b/i,
    daysByLocation: { fridge: 6, freezer: 60, pantry: 2 },
  },
  // Fresh Vegetables & Produce
  {
    keywords: /\b(cucumber|tomato|tomatoes|zucchini|broccoli|cauliflower|bell pepper|peppers|asparagus|green bean|mushroom|celery)\b/i,
    daysByLocation: { fridge: 10, freezer: 180, pantry: 4 },
  },
  // Hearty Fruits & Citrus
  {
    keywords: /\b(apple|apples|orange|oranges|lemon|lemons|lime|limes|grapefruit|pear|pears)\b/i,
    daysByLocation: { fridge: 21, freezer: 180, pantry: 10 },
  },
  // Root Vegetables
  {
    keywords: /\b(potato|potatoes|onion|onions|garlic|carrot|carrots|ginger|shallot|sweet potato)\b/i,
    daysByLocation: { fridge: 28, freezer: 180, pantry: 30 },
  },
  // Milk & Cream
  {
    keywords: /\b(milk|cream|half and half|buttermilk|almond milk|oat milk|soy milk)\b/i,
    daysByLocation: { fridge: 8, freezer: 90, pantry: 1 },
  },
  // Soft / Fresh Cheeses
  {
    keywords: /\b(ricotta|cottage cheese|mozzarella|feta|goat cheese|brie|camembert|cream cheese)\b/i,
    daysByLocation: { fridge: 12, freezer: 90, pantry: 1 },
  },
  // Hard Cheeses & Butter
  {
    keywords: /\b(cheddar|parmesan|gouda|swiss|provolone|butter|ghee)\b/i,
    daysByLocation: { fridge: 60, freezer: 180, pantry: 2 },
  },
  // Yogurt & Sour Cream
  {
    keywords: /\b(yogurt|sour cream|kefir)\b/i,
    daysByLocation: { fridge: 14, freezer: 60, pantry: 1 },
  },
  // Eggs
  {
    keywords: /\b(egg|eggs|egg whites)\b/i,
    daysByLocation: { fridge: 30, freezer: 180, pantry: 7 },
  },
  // Bread & Bakery
  {
    keywords: /\b(bread|bagel|bagels|tortilla|tortillas|pita|buns|rolls|croissant|muffin|pastry)\b/i,
    daysByLocation: { fridge: 14, freezer: 90, pantry: 7 },
  },
  // Condiments & Sauces
  {
    keywords: /\b(mayo|mayonnaise|ketchup|mustard|salad dressing|bbq sauce|hot sauce|salsa|soy sauce|vinegar)\b/i,
    daysByLocation: { fridge: 120, freezer: 180, pantry: 180 },
  },
  // Canned Goods & Broths
  {
    keywords: /\b(canned|can of|beans|broth|soup|tuna can|canned tomatoes)\b/i,
    daysByLocation: { fridge: 5, freezer: 90, pantry: 730 },
  },
  // Grains, Rice, Pasta, Dry goods
  {
    keywords: /\b(pasta|rice|spaghetti|penne|quinoa|oats|cereal|flour|sugar|lentils)\b/i,
    daysByLocation: { fridge: 14, freezer: 365, pantry: 365 },
  },
  // Snacks & Chips
  {
    keywords: /\b(chips|crackers|cookies|nuts|pretzels|popcorn|snack)\b/i,
    daysByLocation: { fridge: 30, freezer: 180, pantry: 60 },
  },
];

export function calculateShelfLifeDays(
  name: string,
  category: string,
  location: PantryLocation = 'pantry'
): number {
  const query = `${name} ${category}`.toLowerCase();

  // Try matching specific food keywords
  for (const rule of SHELF_LIFE_RULES) {
    if (rule.keywords.test(query)) {
      return rule.daysByLocation[location] || 14;
    }
  }

  // Generic category defaults
  const catLower = category.toLowerCase();
  if (catLower.includes('meat') || catLower.includes('poultry') || catLower.includes('seafood')) {
    return location === 'freezer' ? 180 : location === 'fridge' ? 3 : 1;
  }
  if (catLower.includes('dairy') || catLower.includes('cheese') || catLower.includes('milk')) {
    return location === 'freezer' ? 90 : location === 'fridge' ? 10 : 1;
  }
  if (catLower.includes('produce') || catLower.includes('fruit') || catLower.includes('vegetable')) {
    return location === 'freezer' ? 180 : location === 'fridge' ? 7 : 4;
  }
  if (catLower.includes('bakery') || catLower.includes('bread')) {
    return location === 'freezer' ? 90 : location === 'fridge' ? 14 : 7;
  }
  if (catLower.includes('canned') || catLower.includes('pantry') || catLower.includes('dry')) {
    return location === 'freezer' ? 365 : location === 'fridge' ? 7 : 365;
  }
  if (catLower.includes('frozen')) {
    return 180;
  }

  // Ultimate fallback based on location
  if (location === 'freezer') return 180;
  if (location === 'fridge') return 10;
  return 60; // Pantry generic
}

export function calculateExpiryDate(
  name: string,
  category: string,
  location: PantryLocation = 'pantry',
  fromDate: Date = new Date()
): string {
  const days = calculateShelfLifeDays(name, category, location);
  const expiryDate = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getDaysUntilExpiry(expiresAt: string): number {
  if (!expiresAt) return 999;
  const target = new Date(expiresAt + 'T23:59:59').getTime();
  const now = Date.now();
  const diffMs = target - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getFreshnessStatus(expiresAt: string): 'fresh' | 'expiring_soon' | 'expired' {
  const days = getDaysUntilExpiry(expiresAt);
  if (days < 0) return 'expired';
  if (days <= 3) return 'expiring_soon';
  return 'fresh';
}

/**
 * Automatically infers proper storage location (fridge, freezer, or pantry)
 * and refined category based on item name, packaging tags, and culinary knowledge.
 */
export function inferStorageLocation(
  name: string,
  category?: string,
  tags?: string
): { location: PantryLocation; category: string } {
  const combined = `${name || ''} ${category || ''} ${tags || ''}`.toLowerCase();

  // 1. FREEZER: Check frozen foods first
  if (
    /\b(frozen|ice cream|gelato|sorbet|popsicle|popsicles|waffles?|egg[o|os]|tater tots?|french fries|fries|hash browns?|hot pockets?|pizza rolls?|fish sticks?|nuggets?|tenders?|pot pie|ice cubes?|edamame)\b/i.test(
      combined
    ) ||
    combined.includes('frozen food') ||
    combined.includes('frozen meals') ||
    combined.includes('ice-cream')
  ) {
    return {
      location: 'freezer',
      category: category && category !== 'Pantry' && category !== 'Other' ? category : 'Frozen',
    };
  }

  // 2. FRIDGE: Fresh dairy, meats, seafood, chilled produce, fresh condiments, eggs
  if (
    /\b(milk|half and half|heavy cream|whipping cream|buttermilk|creamer|cheese|cheddar|mozzarella|parmesan|swiss|gouda|feta|brie|ricotta|cottage cheese|cream cheese|shredded cheese|butter|ghee|yogurt|sour cream|kefir|eggs?|egg whites?)\b/i.test(
      combined
    )
  ) {
    return { location: 'fridge', category: 'Dairy & Eggs' };
  }

  if (
    /\b(beef|ground beef|steak|roast|brisket|chicken|poultry|turkey|pork|pork chops?|ribs|bacon|sausage|hot dogs?|bratwurst|deli|ham|salami|prosciutto|pepperoni|lunch meat|cold cuts?|fish|salmon|tuna|tilapia|cod|shrimp|scallop|crab|lobster|seafood)\b/i.test(
      combined
    )
  ) {
    return { location: 'fridge', category: 'Meat & Seafood' };
  }

  if (
    /\b(lettuce|spinach|kale|arugula|salad|greens|spring mix|cabbage|coleslaw|berries|strawberry|strawberries|raspberry|raspberries|blueberry|blueberries|blackberry|blackberries|carrots?|celery|cucumber|zucchini|broccoli|cauliflower|asparagus|brussels sprouts?|green beans?|mushrooms?|herbs?|cilantro|parsley|basil|dill|chives?|hummus|guacamole|fresh salsa|tofu|tempeh|meatless|mayo|mayonnaise)\b/i.test(
      combined
    )
  ) {
    return { location: 'fridge', category: 'Produce' };
  }

  if (
    /\b(juice|orange juice|apple cider|lemonade|kombucha|cold brew|smoothie)\b/i.test(
      combined
    )
  ) {
    return { location: 'fridge', category: 'Beverages' };
  }

  // 3. PANTRY: Grains, dry goods, canned items, snacks, spices, baking, root veg, shelf-stable condiments
  if (
    /\b(cereal|granola|oats?|oatmeal|pasta|spaghetti|penne|macaroni|noodles?|ramen|rice|quinoa|couscous|flour|sugar|baking|yeast|cocoa|bread|bagels?|tortillas?|buns?|pita|croissants?|muffins?|canned|beans?|tomato sauce|canned tomatoes|broth|stock|peanut butter|almond butter|jam|jelly|honey|maple syrup|chips?|pretzels?|crackers?|popcorn|cookies?|candy|chocolate|protein bars?|nuts?|almonds?|peanuts?|walnuts?|cashews?|raisins?|trail mix|oil|olive oil|vegetable oil|vinegar|soy sauce|hot sauce|ketchup|mustard|bbq sauce|spices?|seasoning|salt|pepper|coffee|tea|potatoes?|onions?|garlic|shallots?)\b/i.test(
      combined
    )
  ) {
    let cat = 'Pantry';
    if (/\b(chips?|pretzels?|crackers?|popcorn|cookies?|candy|chocolate|nuts?|trail mix|snack)\b/i.test(combined)) {
      cat = 'Snacks';
    } else if (/\b(bread|bagels?|tortillas?|buns?|croissants?|muffins?|pastry|bakery)\b/i.test(combined)) {
      cat = 'Bakery';
    } else if (/\b(potatoes?|onions?|garlic|shallots?)\b/i.test(combined)) {
      cat = 'Produce';
    } else if (/\b(coffee|tea)\b/i.test(combined)) {
      cat = 'Beverages';
    }
    return { location: 'pantry', category: cat };
  }

  // Fallback defaults based on existing category if present
  const catLower = (category || '').toLowerCase();
  if (catLower.includes('frozen')) return { location: 'freezer', category: 'Frozen' };
  if (catLower.includes('dairy') || catLower.includes('meat') || catLower.includes('seafood') || catLower.includes('produce')) {
    return { location: 'fridge', category: category || 'Produce' };
  }
  return { location: 'pantry', category: category || 'Pantry' };
}

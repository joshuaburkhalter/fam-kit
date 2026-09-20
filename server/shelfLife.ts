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

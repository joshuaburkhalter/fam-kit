import type { PantryLocation, FreshnessStatus } from '../types';

export function getDaysUntilExpiry(expiresAt: string): number {
  if (!expiresAt) return 999;
  const now = new Date();
  // Strip time part for standard day difference
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exp = new Date(expiresAt);
  const target = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());

  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getFreshnessStatus(expiresAt: string): FreshnessStatus {
  const days = getDaysUntilExpiry(expiresAt);
  if (days < 0) return 'expired';
  if (days <= 3) return 'expiring_soon';
  return 'fresh';
}

export interface FreshnessBadgeInfo {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

export function getFreshnessBadge(freshness: FreshnessStatus, daysUntilExpiry?: number): FreshnessBadgeInfo {
  const days = daysUntilExpiry ?? 0;

  if (freshness === 'expired') {
    const absDays = Math.abs(days);
    const label = absDays === 0 ? 'Expired today' : `Expired ${absDays}d ago`;
    return {
      label,
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/40',
      borderColor: 'border-red-200 dark:border-red-800/60',
      dotColor: 'bg-red-500',
    };
  }

  if (freshness === 'expiring_soon') {
    const label = days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`;
    return {
      label,
      color: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-200 dark:border-amber-800/60',
      dotColor: 'bg-amber-500',
    };
  }

  // Fresh
  const label = days >= 365 ? '1y+ left' : days > 30 ? `${Math.round(days / 30)}mo left` : `${days}d left`;
  return {
    label,
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800/60',
    dotColor: 'bg-emerald-500',
  };
}

export function getLocationMeta(location: PantryLocation): { label: string; icon: string; bg: string; text: string } {
  switch (location) {
    case 'fridge':
      return {
        label: 'Fridge',
        icon: '🧊',
        bg: 'bg-cyan-50 dark:bg-cyan-950/40',
        text: 'text-cyan-700 dark:text-cyan-300',
      };
    case 'freezer':
      return {
        label: 'Freezer',
        icon: '❄️',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
      };
    case 'pantry':
    default:
      return {
        label: 'Pantry',
        icon: '🥫',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
      };
  }
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

/**
 * Intelligently combines and increments item quantities.
 */
export function addQuantities(
  existingQty: string | null | undefined,
  addedQty: string | null | undefined
): string {
  const eStr = (existingQty || '').trim();
  const aStr = (addedQty || '').trim();

  if (!eStr && !aStr) {
    return '2';
  }

  const numRegex = /^(\d+(?:\.\d+)?)\s*(.*)$/i;
  const eMatch = eStr.match(numRegex);
  const aMatch = aStr.match(numRegex);

  const eNum = eMatch ? parseFloat(eMatch[1]) : (eStr ? NaN : 1);
  const eUnit = eMatch ? eMatch[2].trim() : eStr;

  const aNum = aMatch ? parseFloat(aMatch[1]) : (aStr ? NaN : 1);
  const aUnit = aMatch ? aMatch[2].trim() : aStr;

  const formatUnit = (count: number, rawUnit: string) => {
    if (!rawUnit) return '';
    const clean = rawUnit.toLowerCase();
    if (['oz', 'g', 'kg', 'ml', 'l', 'lbs', 'lb', 'fl oz'].includes(clean)) {
      return rawUnit;
    }
    if (count > 1 && !clean.endsWith('s')) {
      if (clean === 'loaf') return 'loaves';
      return `${rawUnit}s`;
    }
    if (count === 1 && clean.endsWith('s') && !clean.endsWith('ss')) {
      if (clean === 'loaves') return 'loaf';
      return rawUnit.slice(0, -1);
    }
    return rawUnit;
  };

  if (!isNaN(eNum) && !isNaN(aNum)) {
    const total = Math.round((eNum + aNum) * 100) / 100;
    const unit = eUnit || aUnit;
    const formattedUnit = formatUnit(total, unit);
    return formattedUnit ? `${total} ${formattedUnit}` : String(total);
  }

  if (!isNaN(eNum)) {
    const total = Math.round((eNum + 1) * 100) / 100;
    const formattedUnit = formatUnit(total, eUnit || aUnit);
    return formattedUnit ? `${total} ${formattedUnit}` : String(total);
  }
  if (!isNaN(aNum)) {
    const total = Math.round((aNum + 1) * 100) / 100;
    const formattedUnit = formatUnit(total, aUnit || eUnit);
    return formattedUnit ? `${total} ${formattedUnit}` : String(total);
  }

  if (eStr) return `${eStr} (+1)`;
  return '2';
}


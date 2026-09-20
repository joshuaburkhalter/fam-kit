import { GoogleGenerativeAI } from '@google/generative-ai';
import { queryAll, queryOne, execute } from './db.js';
import { calculateExpiryDate, calculateShelfLifeDays, getFreshnessStatus, inferStorageLocation, PantryLocation } from './shelfLife.js';

export interface InventoryItemRow {
  id: string;
  householdId: string;
  name: string;
  barcode: string | null;
  category: string;
  location: PantryLocation;
  quantity: string | null;
  unit: string | null;
  imageUrl: string | null;
  isStock: number;
  restockCadenceDays: number | null;
  lastRestockedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemWithStatus extends InventoryItemRow {
  freshness: 'fresh' | 'expiring_soon' | 'expired';
}

// In-memory barcode lookup cache
const barcodeCache = new Map<string, any>();

/**
 * Lookup barcode via Open Food Facts API (Free, open global food database)
 */
export async function lookupBarcode(barcode: string): Promise<any> {
  const cleanCode = barcode.trim();
  if (barcodeCache.has(cleanCode)) {
    return barcodeCache.get(cleanCode);
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'FamKit-Homebase/1.0 (hello@famkit.app)',
      },
    });

    if (!res.ok) {
      return { found: false };
    }

    const data: any = await res.json();
    if (!data || data.status !== 1 || !data.product) {
      return { found: false };
    }

    const p = data.product;
    const name = p.product_name_en || p.product_name || p.generic_name || 'Grocery Item';
    const brand = p.brands ? p.brands.split(',')[0].trim() : '';
    const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;

    // Detect category & location intelligently
    const categoriesTags = Array.isArray(p.categories_tags) ? p.categories_tags.join(' ').toLowerCase() : '';
    const inferred = inferStorageLocation(fullName, p.categories || '', categoriesTags);
    const category = inferred.category;
    const location = inferred.location;

    const imageUrl = p.image_front_url || p.image_url || null;
    const quantity = p.quantity || null;

    // Auto-calculate expiration date based on category shelf life
    const expiresAt = calculateExpiryDate(fullName, category, location);

    const result = {
      found: true,
      item: {
        barcode: cleanCode,
        name: fullName,
        brand,
        category,
        location,
        quantity,
        imageUrl,
        expiresAt,
      },
    };

    barcodeCache.set(cleanCode, result);
    return result;
  } catch (err) {
    console.error('Error fetching barcode from Open Food Facts:', err);
    return { found: false };
  }
}

/**
 * Scan photo of fridge/pantry/receipt with Gemini Vision.
 * Explicitly instructs the model NOT to read printed expiry stamps,
 * but to extract all food items, categories, and locations.
 */
export async function scanInventoryVision(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  apiKey?: string
): Promise<Array<{ name: string; category: string; location: PantryLocation; quantity: string; expiresAt: string }>> {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const genAI = new GoogleGenerativeAI(activeKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  // Clean data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

  const prompt = `You are a grocery and pantry inventory expert.
Examine this image (which may be a photo of food in a fridge, a pantry shelf, groceries on a counter, or a grocery receipt).
Identify all food and grocery items visible.

For each item, provide:
1. "name": Concise, clean item name (e.g. "Gala Apples", "Chobani Greek Yogurt", "Whole Milk", "Avocados", "Sourdough Bread").
2. "category": One of "Produce", "Dairy & Eggs", "Meat & Seafood", "Bakery", "Pantry", "Frozen", "Beverages", "Snacks", or "Other".
3. "location": Suggest whether it belongs in "fridge", "freezer", or "pantry".
4. "quantity": Approximate quantity seen or listed (e.g. "1 carton", "4 count", "1 loaf", "1 bag", "1 bottle").

CRITICAL INSTRUCTION: DO NOT attempt to read or guess printed expiration dates or best-by stamps from the packaging. Leave expiration calculation to the system.

Return ONLY a valid JSON array of objects with the fields: name, category, location, quantity.
Example:
[
  {"name": "Whole Milk", "category": "Dairy & Eggs", "location": "fridge", "quantity": "1 gallon"},
  {"name": "Baby Spinach", "category": "Produce", "location": "fridge", "quantity": "1 container"},
  {"name": "Spaghetti Pasta", "category": "Pantry", "location": "pantry", "quantity": "1 box"}
]`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
  ]);

  const text = result.response.text().trim();
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  let parsed: any[] = [];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map((item) => {
    const name = String(item.name || 'Food Item').trim();
    // Intelligently infer or validate storage location & category
    const inferred = inferStorageLocation(name, item.category || '');
    let loc: PantryLocation = inferred.location;
    if (item.location === 'freezer' || item.location === 'fridge' || item.location === 'pantry') {
      if (inferred.location === 'pantry' && (item.location === 'freezer' || item.location === 'fridge')) {
        loc = item.location;
      } else {
        loc = inferred.location;
      }
    }
    const category = inferred.category || String(item.category || 'Pantry').trim();
    const quantity = String(item.quantity || '1').trim();

    // Automatically calculate expiration date from category shelf-life rules
    const expiresAt = calculateExpiryDate(name, category, loc);

    return {
      name,
      category,
      location: loc,
      quantity,
      expiresAt,
    };
  });
}

/**
 * Cross-check recipe ingredients against active household inventory items
 */
export function matchRecipeIngredientsAgainstInventory(
  recipeIngredients: Array<{ item?: string; name?: string; amount?: string; unit?: string } | string>,
  inventoryItems: InventoryItemRow[]
): {
  matched: Array<{ ingredient: string; inStockItem: InventoryItemRow; isFresh: boolean }>;
  missing: Array<{ item: string; amount?: string; unit?: string }>;
} {
  const matched: Array<{ ingredient: string; inStockItem: InventoryItemRow; isFresh: boolean }> = [];
  const missing: Array<{ item: string; amount?: string; unit?: string }> = [];

  for (const raw of recipeIngredients) {
    const ingName = typeof raw === 'string' ? raw : (raw.item || raw.name || '');
    if (!ingName.trim()) continue;

    const ingClean = ingName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const ingWords = ingClean.split(/\s+/).filter((w) => w.length > 2 && !['cup', 'cups', 'tbsp', 'tsp', 'oz', 'pound', 'pounds', 'gram', 'grams', 'can', 'cans', 'clove', 'cloves', 'slice', 'slices', 'large', 'small', 'medium'].includes(w));

    let foundMatch: InventoryItemRow | null = null;

    for (const inv of inventoryItems) {
      const invClean = inv.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      
      // Exact or substring match
      if (invClean === ingClean || invClean.includes(ingClean) || ingClean.includes(invClean)) {
        foundMatch = inv;
        break;
      }

      // Word intersection match (e.g. "shredded mozzarella cheese" matches "mozzarella")
      const matchesWord = ingWords.some((w) => invClean.includes(w) && w.length >= 4);
      if (matchesWord) {
        foundMatch = inv;
        break;
      }
    }

    if (foundMatch) {
      const isFresh = getFreshnessStatus(foundMatch.expiresAt) !== 'expired';
      matched.push({
        ingredient: ingName,
        inStockItem: foundMatch,
        isFresh,
      });
    } else {
      missing.push(typeof raw === 'string' ? { item: raw } : { item: ingName, amount: raw.amount, unit: raw.unit });
    }
  }

  return { matched, missing };
}

/**
 * Check for expiring items and staples needing restock across households,
 * sending proactive notifications if any are found.
 */
export async function checkInventoryAlertsForHousehold(householdId: string, sendPush: any) {
  try {
    const items = queryAll<InventoryItemRow>(
      'SELECT * FROM inventory_items WHERE householdId = ?',
      [householdId]
    );
    if (!items || items.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Find items expiring within 2 days (or expired today)
    const expiringItems: InventoryItemRow[] = [];
    const restockItems: InventoryItemRow[] = [];

    for (const item of items) {
      if (item.expiresAt) {
        const days = Math.ceil((new Date(item.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days >= 0 && days <= 2) {
          expiringItems.push(item);
        }
      }

      // Check keep-in-stock staples cadence
      if (item.isStock && item.restockCadenceDays && item.restockCadenceDays > 0) {
        const lastDate = item.lastRestockedAt ? new Date(item.lastRestockedAt) : new Date(item.createdAt);
        const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= item.restockCadenceDays) {
          restockItems.push(item);
        }
      }
    }

    if (expiringItems.length > 0) {
      const sampleNames = expiringItems.slice(0, 2).map((i) => i.name).join(', ');
      const extraCount = expiringItems.length - 2;
      const extraText = extraCount > 0 ? ` and ${extraCount} more` : '';
      await sendPush(
        householdId,
        {
          title: '⚠️ Items Expiring Soon',
          body: `${sampleNames}${extraText} will expire in the next 48 hours. Check your pantry!`,
          url: '/meals?tab=pantry',
          tag: `inventory-expiring-${todayStr}`,
        },
        { category: 'meal_plans' }
      );
    } else if (restockItems.length > 0) {
      const sampleNames = restockItems.slice(0, 2).map((i) => i.name).join(', ');
      await sendPush(
        householdId,
        {
          title: '⭐ Pantry Staples Reminder',
          body: `Time to check stock on ${sampleNames}. Tap to review or add to your grocery list.`,
          url: '/meals?tab=pantry',
          tag: `inventory-restock-${todayStr}`,
        },
        { category: 'meal_plans' }
      );
    }
  } catch (err) {
    console.error('Error running checkInventoryAlertsForHousehold:', err);
  }
}

let inventoryAlertTimer: NodeJS.Timeout | null = null;

/**
 * Periodically check inventory expiry and staple alerts across households
 */
export function initBackgroundInventoryAlerts(sendPush: any): void {
  if (inventoryAlertTimer) return;

  const runChecks = async () => {
    try {
      const households = queryAll<{ id: string }>('SELECT id FROM households');
      for (const h of households) {
        await checkInventoryAlertsForHousehold(h.id, sendPush);
      }
    } catch (e) {
      console.error('Inventory alerts background check error:', e);
    }
  };

  // Initial check after 30 seconds
  setTimeout(runChecks, 30000);

  // Periodic check every 4 hours
  inventoryAlertTimer = setInterval(runChecks, 4 * 60 * 60 * 1000);
}

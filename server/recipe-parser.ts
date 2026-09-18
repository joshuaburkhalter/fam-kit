import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedRecipe {
  title: string;
  description?: string;
  imageUrl?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: string;
  sourceUrl?: string;
  ingredients: Array<{
    item: string;
    amount?: string;
    unit?: string;
    category?: string;
  }>;
  instructions: string[];
  tags?: string[];
}

export function formatDuration(isoOrText?: string): string | undefined {
  if (!isoOrText) return undefined;
  const isoMatch = isoOrText.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (isoMatch) {
    const hours = isoMatch[1] ? `${isoMatch[1]} hr` : '';
    const mins = isoMatch[2] ? `${isoMatch[2]} min` : '';
    return [hours, mins].filter(Boolean).join(' ') || isoOrText;
  }
  return isoOrText;
}

export async function parseRecipeFromUrl(url: string, geminiApiKey?: string): Promise<ParsedRecipe> {
  const activeKey = geminiApiKey || process.env.GEMINI_API_KEY;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    // If blocked with 402/403 (e.g. Allrecipes anti-bot), retry with social link preview headers
    // which websites whitelist so users can unfurl links with original photos & metadata!
    if (!response.ok && (response.status === 402 || response.status === 403)) {
      try {
        const retryResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(12000),
        });
        if (retryResponse.ok) {
          response = retryResponse;
        }
      } catch {}
    }
  } catch (fetchErr: any) {
    if (activeKey) {
      return synthesizeRecipeFromUrlWithAi(url, activeKey);
    }
    throw fetchErr;
  }

  if (!response.ok) {
    if (response.status === 402 || response.status === 403) {
      // If AI key is configured, automatically synthesize the recipe from the URL metadata & slug!
      if (activeKey) {
        try {
          return await synthesizeRecipeFromUrlWithAi(url, activeKey);
        } catch (aiErr) {
          console.warn('AI recipe synthesis failed:', aiErr);
        }
      }

      throw new Error(
        `This website (${new URL(url).hostname}) blocks automated recipe crawlers (${response.status}: ${response.statusText}). Configure your Gemini API key in Settings for automatic AI recipe generation, or paste the recipe text in "Paste Content".`
      );
    }
    throw new Error(`Failed to fetch recipe URL (${response.status}: ${response.statusText})`);
  }

  const html = await response.text();
  return parseRecipeFromHtml(html, url, geminiApiKey);
}

export interface DishFamily {
  name: string;
  keywords: string[];
}

export const DISH_FAMILIES: DishFamily[] = [
  {
    name: 'soup',
    keywords: ['soup', 'soups', 'chowder', 'chowders', 'stew', 'stews', 'chili', 'chilis', 'bisque', 'gumbo', 'broth', 'pozole', 'menudo'],
  },
  {
    name: 'salad',
    keywords: ['salad', 'salads', 'slaw', 'coleslaw'],
  },
  {
    name: 'pizza',
    keywords: ['pizza', 'pizzas', 'calzone', 'calzones', 'flatbread', 'flatbreads'],
  },
  {
    name: 'sandwich',
    keywords: ['sandwich', 'sandwiches', 'burger', 'burgers', 'panini', 'wrap', 'wraps', 'sub', 'subs', 'hoagie', 'slider', 'sliders'],
  },
  {
    name: 'taco',
    keywords: ['taco', 'tacos', 'taquito', 'taquitos', 'fajita', 'fajitas', 'burrito', 'burritos', 'quesadilla', 'quesadillas', 'enchilada', 'enchiladas'],
  },
  {
    name: 'pasta',
    keywords: ['pasta', 'spaghetti', 'fettuccine', 'linguine', 'penne', 'lasagna', 'ravioli', 'macaroni', 'ziti', 'tortellini', 'rotini', 'rigatoni'],
  },
  {
    name: 'dessert',
    keywords: ['cake', 'cakes', 'cookie', 'cookies', 'pie', 'pies', 'cupcake', 'cupcakes', 'brownie', 'brownies', 'pudding', 'ice cream', 'muffin', 'muffins', 'cheesecake'],
  },
];

/**
 * Returns the primary dish family for a dish title.
 * In English culinary naming, modifier words precede head nouns (e.g. "Taco Soup" -> soup, "Taco Salad" -> salad).
 * We track the last matched family to honor the head noun.
 */
export function getDishFamily(text: string): DishFamily | null {
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  let lastFound: DishFamily | null = null;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (const family of DISH_FAMILIES) {
      if (family.keywords.includes(word)) {
        lastFound = family;
      }
    }
  }
  return lastFound;
}

export const SIGNATURE_DISH_IMAGES: Record<string, string[]> = {
  // --- Skillet & Specialty Chicken (Prevents generic roast carcasses!) ---
  'tuscan chicken': [
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
  ],
  'creamy garlic chicken': [
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=800&auto=format&fit=crop&q=80',
  ],
  'garlic chicken': [
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
  ],
  'creamy chicken': [
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&auto=format&fit=crop&q=80',
  ],
  'lemon herb chicken': [
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
  ],
  'lemon chicken': [
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
  ],
  'skillet chicken': [
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Bowls (Salmon Bowl, Poke Bowl, Grain & Rice Bowls) ---
  'salmon bowl': [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  ],
  'tzatziki bowl': [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  ],
  'mediterranean bowl': [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  ],
  'poke bowl': [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  ],
  'grain bowl': [
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  ],
  'rice bowl': [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  ],
  'teriyaki bowl': [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
  ],
  'burrito bowl': [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Salmon & Seafood Fillets ---
  'garlic butter salmon': [
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  ],
  'pan-seared salmon': [
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80',
  ],
  'baked salmon': [
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80',
  ],
  'grilled salmon': [
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80',
  ],
  'shrimp scampi': [
    'https://images.unsplash.com/photo-1559742811-822873691df8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Soups, Stews & Chilis ---
  'taco soup': [
    'https://images.unsplash.com/photo-1527976746453-f363eac4d889?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1695088220737-9a6d901db8f1?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1695088223408-cd5ae3b2b7fa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603355736640-34a2bee52da3?w=800&auto=format&fit=crop&q=80',
  ],
  'tortilla soup': [
    'https://images.unsplash.com/photo-1695088220737-9a6d901db8f1?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527976746453-f363eac4d889?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1695088223408-cd5ae3b2b7fa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603355736640-34a2bee52da3?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken tortilla soup': [
    'https://images.unsplash.com/photo-1695088220737-9a6d901db8f1?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527976746453-f363eac4d889?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1695088223408-cd5ae3b2b7fa?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken noodle soup': [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
  ],
  'white chicken chili': [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527976746453-f363eac4d889?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
  ],
  'beef chili': [
    'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1695088223408-cd5ae3b2b7fa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603355736640-34a2bee52da3?w=800&auto=format&fit=crop&q=80',
  ],
  'chili con carne': [
    'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1695088223408-cd5ae3b2b7fa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603355736640-34a2bee52da3?w=800&auto=format&fit=crop&q=80',
  ],
  'chili': [
    'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1695088223408-cd5ae3b2b7fa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603355736640-34a2bee52da3?w=800&auto=format&fit=crop&q=80',
  ],
  'french onion soup': [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
  ],
  'potato soup': [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
  ],
  'broccoli cheddar soup': [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
  ],
  'tomato soup': [
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1594756202469-9ff9799b2e4e?w=800&auto=format&fit=crop&q=80',
  ],
  'beef stew': [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Salads ---
  'taco salad': [
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800&auto=format&fit=crop&q=80',
  ],
  'caesar salad': [
    'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  ],
  'greek salad': [
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  ],
  'cobb salad': [
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Tacos & Mexican ---
  'sheet pan fajitas': [
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken fajitas': [
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  ],
  'birria tacos': [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=800&auto=format&fit=crop&q=80',
  ],
  'fish tacos': [
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  ],
  'shrimp tacos': [
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  ],
  'tacos': [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?w=800&auto=format&fit=crop&q=80',
  ],
  'taco': [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=800&auto=format&fit=crop&q=80',
  ],
  'fajitas': [
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&auto=format&fit=crop&q=80',
  ],
  'enchiladas': [
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  ],
  'quesadilla': [
    'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Italian & Pasta ---
  'chicken parmesan': [
    'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken parmigiana': [
    'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken parm': [
    'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
  ],
  'parmesan chicken': [
    'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken alfredo': [
    'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken marsala': [
    'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken piccata': [
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
  ],
  'lasagna': [
    'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
  ],
  'mac and cheese': [
    'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
  ],
  'macaroni and cheese': [
    'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Poultry & Meats ---
  'chicken tenders': [
    'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken tender': [
    'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken nuggets': [
    'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=80',
  ],
  'fried chicken': [
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&auto=format&fit=crop&q=80',
  ],
  'crispy chicken': [
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken wings': [
    'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken wing': [
    'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&auto=format&fit=crop&q=80',
  ],
  'roast chicken': [
    'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&auto=format&fit=crop&q=80',
  ],
  'beef stroganoff': [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Pizza & Burgers ---
  'pizza': [
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&auto=format&fit=crop&q=80',
  ],
  'burger': [
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Asian & Stir Fries ---
  'chicken stir fry': [
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  ],
  'fried rice': [
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
  ],
  'chicken curry': [
    'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  ],
  'tikka masala': [
    'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  ],

  // --- Baking & Desserts ---
  'chocolate chip cookie': [
    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80',
  ],
};

const CURATED_FOOD_IMAGES: Record<string, string[]> = {
  // Plated Chicken & Poultry (appetizing cutlets, bowls & skillets - NOT whole carcasses!)
  chicken: [
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=800&auto=format&fit=crop&q=80',
  ],
  poultry: [
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
  ],
  turkey: [
    'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
  ],

  // Seafood & Salmon
  salmon: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  ],
  fish: [
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80',
  ],
  seafood: [
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559742811-822873691df8?w=800&auto=format&fit=crop&q=80',
  ],
  shrimp: [
    'https://images.unsplash.com/photo-1559742811-822873691df8?w=800&auto=format&fit=crop&q=80',
  ],

  // Bowls & Salads
  bowl: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  ],
  salad: [
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800&auto=format&fit=crop&q=80',
  ],

  // Pastas & Noodles
  pasta: [
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=800&auto=format&fit=crop&q=80',
  ],
  spaghetti: [
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=800&auto=format&fit=crop&q=80',
  ],
  noodle: [
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80',
  ],
  ramen: [
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
  ],

  // Soups & Stews
  soup: [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  ],
  stew: [
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=800&auto=format&fit=crop&q=80',
  ],

  // Meats
  beef: [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
  ],
  steak: [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  ],
  pork: [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
  ],
  ribs: [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  ],

  // Mexican
  mexican: [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&auto=format&fit=crop&q=80',
  ],
  burrito: [
    'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80',
  ],

  // Pizza, Burgers & Sandwiches
  pizza: [
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&auto=format&fit=crop&q=80',
  ],
  burger: [
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&auto=format&fit=crop&q=80',
  ],
  sandwich: [
    'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80',
  ],

  // Rice & Asian
  rice: [
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  ],
  curry: [
    'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  ],

  // Breakfast
  breakfast: [
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
  ],
  egg: [
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
  ],
  pancake: [
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80',
  ],
  waffle: [
    'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&auto=format&fit=crop&q=80',
  ],

  // Baking & Desserts
  dessert: [
    'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80',
  ],
  cookie: [
    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80',
  ],
  smoothie: [
    'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&auto=format&fit=crop&q=80',
  ],
  vegetarian: [
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  ],

  // Rich, diverse high-resolution default food photography pool
  default: [
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80',
  ],
};

export function getCuratedFoodImage(title: string = '', tags: string[] = []): string {
  const query = `${title} ${tags.join(' ')}`.toLowerCase();
  const primaryDishFamily = getDishFamily(title);

  // 1. Check specialized signature dishes first (longest match first)
  const signatureKeys = Object.keys(SIGNATURE_DISH_IMAGES).sort((a, b) => b.length - a.length);
  for (const dish of signatureKeys) {
    if (query.includes(dish)) {
      if (primaryDishFamily) {
        const dishFam = getDishFamily(dish);
        if (dishFam && dishFam.name !== primaryDishFamily.name) continue;
      }
      return SIGNATURE_DISH_IMAGES[dish][0];
    }
  }

  // 2. Check general curated categories
  const sortedKeys = Object.keys(CURATED_FOOD_IMAGES)
    .filter((k) => k !== 'default')
    .sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (query.includes(key)) {
      if (primaryDishFamily) {
        const keyFam = getDishFamily(key);
        if (keyFam && keyFam.name !== primaryDishFamily.name) continue;
      }
      return CURATED_FOOD_IMAGES[key][0];
    }
  }
  return CURATED_FOOD_IMAGES.default[0];
}

export async function findAccurateRecipePhoto(
  title: string = '',
  description: string = '',
  tags: string[] = [],
  imageQuery?: string,
  usedImages: Set<string> = new Set<string>(),
  ingredients: Array<any> = []
): Promise<string> {
  const queryText = `${title} ${imageQuery || ''} ${tags.join(' ')}`.toLowerCase();
  const primaryDishFamily = getDishFamily(title) || (imageQuery ? getDishFamily(imageQuery) : null);

  // 1. Check specialized signature dishes first (sorted by dish name length descending)
  // Ensures composite dishes (e.g. "tuscan chicken", "salmon bowl") match before broad words
  const signatureKeys = Object.keys(SIGNATURE_DISH_IMAGES).sort((a, b) => b.length - a.length);
  for (const dish of signatureKeys) {
    if (queryText.includes(dish)) {
      // Dish family anti-confusion protection (e.g. skip 'taco' when primary dish is 'soup')
      if (primaryDishFamily) {
        const dishFamily = getDishFamily(dish);
        if (dishFamily && dishFamily.name !== primaryDishFamily.name) {
          continue;
        }
      }

      const candidates = SIGNATURE_DISH_IMAGES[dish];
      const unused = candidates.find((url) => !usedImages.has(url));
      if (unused) {
        usedImages.add(unused);
        return unused;
      }
      // If all candidates in this signature dish were already seen, DO NOT loop back to the same 2!
      // Fall through to search Wikimedia Commons and broader pools for fresh photos!
    }
  }

  // 2. Try Wikimedia Commons High-Res Food Photo Search
  const cleanTitle = title
    .replace(/^(how to make|easy|best|crispy|creamy|homemade|quick|simple|ultimate|classic|baked|pan-seared|slow cooker|instant pot|sheet pan)\s+/gi, '')
    .replace(/\s+(recipe|dish|style)$/gi, '')
    .trim();

  // Filler words that should not be used as unique keyword filters
  const FILLER_WORDS = new Set([
    'recipe', 'recipes', 'dish', 'dishes', 'food', 'style', 'easy', 'best',
    'homemade', 'quick', 'simple', 'ultimate', 'classic', 'how', 'make', 'cook',
    'cooking', 'delicious', 'perfect', 'favorite', 'instant', 'pot', 'slow', 'cooker',
    'dinner', 'lunch', 'breakfast'
  ]);

  const distinctKeywords = cleanTitle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !FILLER_WORDS.has(w));

  // Build list of search query candidates for Wikimedia Commons
  const searchQueries: string[] = [];
  if (cleanTitle) searchQueries.push(`${cleanTitle} food`);
  if (primaryDishFamily && distinctKeywords.length > 0) {
    searchQueries.push(`${distinctKeywords[0]} ${primaryDishFamily.name}`);
  }
  if (cleanTitle) searchQueries.push(cleanTitle);

  for (const query of searchQueries) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        query
      )}&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=1200`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(commonsUrl, {
        headers: { 'User-Agent': 'FamKitApp/1.0 (contact@famkit.app)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        const pages = Object.values(data.query?.pages || {}) as Array<{
          title: string;
          imageinfo?: Array<{ url?: string; thumburl?: string }>;
        }>;

        const match = pages.find((p) => {
          const imgUrl = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url;
          if (!imgUrl || usedImages.has(imgUrl)) return false;
          const lowerUrl = imgUrl.toLowerCase();
          const lowerTitle = p.title.toLowerCase();

          // Reject non-image documents, vector icons, or book/catalog scans
          const NON_FOOD_TERMS = [
            '.djvu',
            '.pdf',
            '.tif',
            '.svg',
            'catalog',
            'planter',
            'seeds',
            'journal',
            'document',
            'census',
            'manuscript',
            'statue',
            'map',
            'diagram',
          ];
          if (NON_FOOD_TERMS.some((term) => lowerUrl.includes(term) || lowerTitle.includes(term))) {
            return false;
          }

          // Anti-confusion check: if recipe has a primary dish family, candidate must belong to it
          if (primaryDishFamily) {
            const candFamily = getDishFamily(lowerTitle);
            if (candFamily && candFamily.name !== primaryDishFamily.name) {
              return false;
            }
          }

          // Must match at least one distinct keyword from the recipe title or be a verified culinary file
          const hasKeywordMatch = distinctKeywords.some((w) => lowerTitle.includes(w));
          const hasFoodTerm = ['food', 'dish', 'recipe', 'plated', 'cooking', 'cuisine', 'meal', 'bowl', 'soup', 'salad', 'chicken', 'salmon', 'taco', 'pasta', 'stew', 'dinner'].some((k) => lowerTitle.includes(k));
          return hasKeywordMatch || hasFoodTerm;
        });

        const selectedUrl = match?.imageinfo?.[0]?.thumburl || match?.imageinfo?.[0]?.url;
        if (selectedUrl) {
          usedImages.add(selectedUrl);
          return selectedUrl;
        }
      }
    } catch {
      // Continue to next query or Wikipedia
    }
  }

  // 2B. Search Wikipedia article photos
  if (cleanTitle && distinctKeywords.length > 0) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(
        cleanTitle
      )}&gsrlimit=4&prop=pageimages&piprop=thumbnail&pithumbsize=960`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'FamKitApp/1.0 (contact@famkit.app)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        const pages = Object.values(data.query?.pages || {}) as Array<{
          title: string;
          thumbnail?: { source: string };
        }>;

        const match = pages.find((p) => {
          if (!p.thumbnail?.source || usedImages.has(p.thumbnail.source)) return false;
          const lowerTitle = p.title.toLowerCase();

          if (primaryDishFamily) {
            const candFamily = getDishFamily(lowerTitle);
            if (candFamily && candFamily.name !== primaryDishFamily.name) return false;
          }

          return distinctKeywords.some((w) => lowerTitle.includes(w));
        });

        if (match?.thumbnail?.source) {
          usedImages.add(match.thumbnail.source);
          return match.thumbnail.source;
        }
      }
    } catch {
      // Fall through to curated photography
    }
  }

  // 3. Check general curated categories (pools of high-resolution Unsplash photography)
  const allCuratedKeys = Object.keys(CURATED_FOOD_IMAGES)
    .filter((k) => k !== 'default')
    .sort((a, b) => b.length - a.length);

  for (const key of allCuratedKeys) {
    if (queryText.includes(key)) {
      if (primaryDishFamily) {
        const keyFamily = getDishFamily(key);
        if (keyFamily && keyFamily.name !== primaryDishFamily.name) {
          continue; // e.g. never pick tacos or chicken wings for soup
        }
      }
      const candidates = CURATED_FOOD_IMAGES[key];
      const unused = candidates.find((url) => !usedImages.has(url));
      if (unused) {
        usedImages.add(unused);
        return unused;
      }
    }
  }

  // 4. Default high-resolution Unsplash food photography pool
  const defaultPool = CURATED_FOOD_IMAGES.default;
  const unusedDefault = defaultPool.find((url) => !usedImages.has(url));
  if (unusedDefault) {
    usedImages.add(unusedDefault);
    return unusedDefault;
  }

  // If literally every candidate in the default pool was used in this session,
  // pick the one that differs from the most recently shown image
  const lastUsed = Array.from(usedImages).slice(-1)[0];
  return defaultPool.find((c) => c !== lastUsed) || defaultPool[0];
}

/**
 * Generate a custom, pristine food photograph for a recipe using Google Imagen 3.
 * Uses the user's Gemini API key from Google AI Studio.
 */
export async function generateRecipeImageWithImagen(
  recipe: { title: string; description?: string; ingredients?: Array<any> },
  apiKey: string
): Promise<string> {
  const ingredientsList = (recipe.ingredients || [])
    .slice(0, 5)
    .map((ing) => (typeof ing === 'string' ? ing : ing.item || ing.name))
    .filter(Boolean)
    .join(', ');

  const prompt = `Delicious, appetizing, professionally plated gourmet dish of ${recipe.title}${
    ingredientsList ? ` made with ${ingredientsList}` : ''
  }. ${recipe.description || ''}. Beautiful restaurant food photography, crisp focus, studio lighting, shallow depth of field, vibrant colors, authentic culinary presentation.`.slice(0, 480);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '4:3',
          outputMimeType: 'image/jpeg',
          compressionQuality: 80,
        },
      }),
      signal: AbortSignal.timeout(25000),
    }
  );

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const message =
      errJson.error?.message ||
      `Google Imagen 3 API failed (${res.status}: ${res.statusText}). Make sure billing is enabled in Google AI Studio.`;
    throw new Error(message);
  }

  const data = (await res.json()) as any;
  const base64Bytes = data.predictions?.[0]?.bytesBase64Encoded;
  const mimeType = data.predictions?.[0]?.mimeType || 'image/jpeg';
  if (!base64Bytes) {
    throw new Error('No image was returned from Google Imagen 3.');
  }

  return `data:${mimeType};base64,${base64Bytes}`;
}

export async function synthesizeRecipeFromUrlWithAi(url: string, apiKey: string): Promise<ParsedRecipe> {
  // Extract slug information (e.g. "meatball-nirvana" from "/recipe/213742/meatball-nirvana/")
  const parsedUrl = new URL(url);
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const rawSlug = segments[segments.length - 1] || segments[segments.length - 2] || 'recipe';
  const inferredTitle = rawSlug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `The user wants to import a recipe from this URL: "${url}" (Title/Slug: "${inferredTitle}").
The website blocked direct HTML scraping with a 402 bot-protection response.
Generate a complete, authentic, high-quality recipe matching "${inferredTitle}" as typically found on ${parsedUrl.hostname}.

Return ONLY a valid JSON object with this exact schema (no markdown fences, just JSON):
{
  "title": "${inferredTitle}",
  "description": "Authentic ${inferredTitle} recipe inspired by ${parsedUrl.hostname}.",
  "prepTime": "15 min",
  "cookTime": "25 min",
  "servings": "4",
  "ingredients": [
    { "item": "1 lb ingredients with amount", "amount": "1", "unit": "lb", "category": "Produce" }
  ],
  "instructions": [
    "Step 1...",
    "Step 2..."
  ],
  "tags": ["Dinner", "Asian"]
}`;

  const res = await model.generateContent(prompt);
  const text = res.response.text().trim();
  const cleanedJson = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleanedJson);

  const finalTitle = parsed.title || inferredTitle;
  const finalTags = Array.isArray(parsed.tags) ? parsed.tags : ['Imported'];
  const finalImage = parsed.imageUrl || getCuratedFoodImage(finalTitle, finalTags);

  return {
    title: finalTitle,
    description: parsed.description || `Recipe for ${finalTitle}`,
    imageUrl: finalImage,
    prepTime: parsed.prepTime || '15 min',
    cookTime: parsed.cookTime || '25 min',
    totalTime: parsed.totalTime,
    servings: parsed.servings?.toString() || '4',
    sourceUrl: url,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
    tags: finalTags,
  };
}

export async function parseRecipeFromHtml(
  html: string,
  sourceUrl: string = '',
  geminiApiKey?: string
): Promise<ParsedRecipe> {
  const $ = cheerio.load(html);

  // 1. Check schema.org/Recipe JSON-LD
  const jsonLdScripts = $('script[type="application/ld+json"]');
  let recipeSchema: any = null;

  jsonLdScripts.each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const parsed = JSON.parse(content.trim());

      const findRecipe = (obj: any): any => {
        if (!obj) return null;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = findRecipe(item);
            if (found) return found;
          }
        } else if (typeof obj === 'object') {
          const type = obj['@type'];
          if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
            return obj;
          }
          if (obj['@graph'] && Array.isArray(obj['@graph'])) {
            return findRecipe(obj['@graph']);
          }
        }
        return null;
      };

      const found = findRecipe(parsed);
      if (found) {
        recipeSchema = found;
        return false;
      }
    } catch {}
  });

  if (recipeSchema) {
    return extractFromJsonLd(recipeSchema, $, sourceUrl);
  }

  // 2. Gemini fallback
  return extractWithGeminiFallback(html, $, sourceUrl, geminiApiKey);
}

function extractFromJsonLd(schema: any, $: cheerio.CheerioAPI, url: string): ParsedRecipe {
  const title =
    schema.name ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().replace(/ - .*/, '').trim() ||
    'Imported Recipe';

  const description =
    schema.description ||
    $('meta[property="og:description"]').attr('content') ||
    undefined;

  let imageUrl: string | undefined = undefined;
  if (schema.image) {
    if (typeof schema.image === 'string') imageUrl = schema.image;
    else if (Array.isArray(schema.image) && schema.image[0]) {
      imageUrl = typeof schema.image[0] === 'string' ? schema.image[0] : schema.image[0].url;
    } else if (schema.image.url) imageUrl = schema.image.url;
  }
  if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content');

  const prepTime = formatDuration(schema.prepTime);
  const cookTime = formatDuration(schema.cookTime);
  const totalTime = formatDuration(schema.totalTime);

  let servings: string | undefined = undefined;
  if (schema.recipeYield) {
    servings = Array.isArray(schema.recipeYield)
      ? schema.recipeYield[0]?.toString()
      : schema.recipeYield?.toString();
  }

  const ingredients: Array<{ item: string; amount?: string; unit?: string; category?: string }> = [];
  const rawIngredients = schema.recipeIngredient || schema.ingredients || [];
  if (Array.isArray(rawIngredients)) {
    for (const raw of rawIngredients) {
      if (typeof raw === 'string' && raw.trim()) {
        ingredients.push({ item: raw.trim() });
      }
    }
  }

  const instructions: string[] = [];
  const rawInstructions = schema.recipeInstructions || [];
  if (Array.isArray(rawInstructions)) {
    for (const step of rawInstructions) {
      if (typeof step === 'string' && step.trim()) {
        instructions.push(step.trim());
      } else if (step && typeof step === 'object') {
        if (step['@type'] === 'HowToStep' && step.text) {
          instructions.push(step.text.trim());
        } else if (step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
          for (const sub of step.itemListElement) {
            if (sub?.text) instructions.push(sub.text.trim());
          }
        } else if (step.text) {
          instructions.push(step.text.trim());
        }
      }
    }
  } else if (typeof rawInstructions === 'string') {
    instructions.push(...rawInstructions.split(/\n+/).map((s) => s.trim()).filter(Boolean));
  }

  const tags: string[] = [];
  if (schema.recipeCategory) {
    if (Array.isArray(schema.recipeCategory)) tags.push(...schema.recipeCategory);
    else tags.push(schema.recipeCategory.toString());
  }

  return {
    title,
    description,
    imageUrl,
    prepTime,
    cookTime,
    totalTime,
    servings,
    sourceUrl: url,
    ingredients: ingredients.length > 0 ? ingredients : [{ item: 'Check recipe link for ingredients' }],
    instructions: instructions.length > 0 ? instructions : ['Follow directions on recipe website'],
    tags: tags.filter(Boolean),
  };
}

async function extractWithGeminiFallback(
  html: string,
  $: cheerio.CheerioAPI,
  url: string,
  apiKey?: string
): Promise<ParsedRecipe> {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  const pageTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || 'Recipe';
  const pageImage = $('meta[property="og:image"]').attr('content');
  const pageDesc = $('meta[property="og:description"]').attr('content');

  $('script, style, nav, footer, header, noscript, svg').remove();
  const cleanText = $('body').text().replace(/\s+/g, ' ').slice(0, 15000);

  if (activeKey) {
    try {
      const genAI = new GoogleGenerativeAI(activeKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

      const prompt = `Extract the recipe from this content:
URL: ${url}
Title: ${pageTitle}

Return a valid JSON object only:
{
  "title": "Recipe Title",
  "description": "Short summary",
  "imageUrl": "${pageImage || ''}",
  "prepTime": "15 min",
  "cookTime": "30 min",
  "servings": "4",
  "ingredients": [{ "item": "exact ingredient name with amount (e.g. '1/2 cup egg white protein powder', never shorten to 'egg whites')", "category": "Pantry & Dry Goods" }],
  "instructions": ["Step 1...", "Step 2..."],
  "tags": ["Dinner"]
}

Important: Keep ingredient names exact and specific (e.g. "egg white protein powder", not just "egg whites"; "almond flour", not just "flour"). Do not generalize specialty ingredients.

Content:
${cleanText}`;

      const res = await model.generateContent(prompt);
      const text = res.response.text().trim();
      const cleanedJson = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleanedJson);

      return {
        title: parsed.title || pageTitle,
        description: parsed.description || pageDesc,
        imageUrl: parsed.imageUrl || pageImage,
        prepTime: parsed.prepTime,
        cookTime: parsed.cookTime,
        servings: parsed.servings?.toString(),
        sourceUrl: url,
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    } catch (err) {
      console.warn('Gemini fallback error:', err);
    }
  }

  return {
    title: pageTitle,
    description: pageDesc,
    imageUrl: pageImage,
    sourceUrl: url,
    ingredients: [{ item: 'Please view source link for ingredient details' }],
    instructions: ['Please view source link for preparation instructions'],
    tags: ['Imported'],
  };
}

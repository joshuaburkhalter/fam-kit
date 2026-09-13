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

const CURATED_FOOD_IMAGES: Record<string, string> = {
  // Specific dishes (checked first via length sorting)
  'chicken parmesan': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
  'chicken parmigiana': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
  'chicken parm': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
  'chicken alfredo': 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&auto=format&fit=crop&q=80',
  'chicken marsala': 'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=800&auto=format&fit=crop&q=80',
  'chicken tenders': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=80',
  'chicken tender': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=80',
  'fried chicken': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&auto=format&fit=crop&q=80',
  'crispy chicken': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&auto=format&fit=crop&q=80',
  'chicken wings': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&auto=format&fit=crop&q=80',
  'chicken wing': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&auto=format&fit=crop&q=80',
  'roast chicken': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&auto=format&fit=crop&q=80',
  'chicken breast': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80',
  'parmesan': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
  'parm': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&auto=format&fit=crop&q=80',
  'garlic butter salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  'chocolate chip cookie': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80',
  'mac and cheese': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',
  'macaroni and cheese': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',

  // General categories & ingredients
  banh: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  vietnamese: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  salad: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
  ramen: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
  pasta: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=800&auto=format&fit=crop&q=80',
  spaghetti: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=800&auto=format&fit=crop&q=80',
  chicken: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&auto=format&fit=crop&q=80',
  poultry: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&auto=format&fit=crop&q=80',
  turkey: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=800&auto=format&fit=crop&q=80',
  meatball: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&auto=format&fit=crop&q=80',
  beef: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  steak: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  pork: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  ribs: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  bacon: 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=800&auto=format&fit=crop&q=80',
  soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  stew: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  chili: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
  sandwich: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80',
  taco: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  burrito: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80',
  mexican: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  salmon: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  fish: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  seafood: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  shrimp: 'https://images.unsplash.com/photo-1559742811-822873691df8?w=800&auto=format&fit=crop&q=80',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80',
  toast: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
  egg: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
  omelet: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
  waffle: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&auto=format&fit=crop&q=80',
  cake: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80',
  cookie: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80',
  muffin: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=800&auto=format&fit=crop&q=80',
  pie: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=800&auto=format&fit=crop&q=80',
  dessert: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=80',
  chocolate: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&auto=format&fit=crop&q=80',
  pancake: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80',
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80',
  curry: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
  stir: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
  lasagna: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80',
  potato: 'https://images.unsplash.com/photo-1518013034458-30d88562f161?w=800&auto=format&fit=crop&q=80',
  smoothie: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&auto=format&fit=crop&q=80',
  vegetarian: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&auto=format&fit=crop&q=80',
};

export function getCuratedFoodImage(title: string = '', tags: string[] = []): string {
  const query = `${title} ${tags.join(' ')}`.toLowerCase();
  const sortedKeys = Object.keys(CURATED_FOOD_IMAGES)
    .filter((k) => k !== 'default')
    .sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (query.includes(key)) {
      return CURATED_FOOD_IMAGES[key];
    }
  }
  return CURATED_FOOD_IMAGES.default;
}

export async function findAccurateRecipePhoto(
  title: string = '',
  description: string = '',
  tags: string[] = [],
  imageQuery?: string
): Promise<string> {
  const queryText = `${title} ${imageQuery || ''} ${tags.join(' ')}`.toLowerCase();

  const DISH_SPECIALTIES = [
    'chicken parmesan',
    'chicken parmigiana',
    'chicken parm',
    'parmesan chicken',
    'parm chicken',
    'parmesan',
    'parm',
    'chicken alfredo',
    'chicken marsala',
    'chicken piccata',
    'chicken tenders',
    'chicken tender',
    'chicken nuggets',
    'chicken nugget',
    'chicken wings',
    'chicken wing',
    'chicken soup',
    'roast chicken',
    'fried chicken',
    'crispy chicken',
    'mac and cheese',
    'macaroni and cheese',
    'garlic butter salmon',
    'beef stroganoff',
    'shrimp scampi',
  ];

  // 1. Check specialized signature dishes first
  for (const dish of DISH_SPECIALTIES) {
    if (queryText.includes(dish) && CURATED_FOOD_IMAGES[dish]) {
      return CURATED_FOOD_IMAGES[dish];
    }
  }

  // 2. High-priority curated match: check multi-word dishes (length >= 6)
  const sortedKeys = Object.keys(CURATED_FOOD_IMAGES)
    .filter((k) => k !== 'default' && k.length >= 6)
    .sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (queryText.includes(key)) {
      return CURATED_FOOD_IMAGES[key];
    }
  }

  // 2. Try Wikipedia Dish Photo Search
  const cleanTitle = title
    .replace(/^(how to make|easy|best|crispy|creamy|homemade|quick|simple|ultimate|classic)\s+/gi, '')
    .replace(/\s+(recipe|dish|style)$/gi, '')
    .trim();

  if (cleanTitle) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(
        cleanTitle
      )}&gsrlimit=4&prop=pageimages&piprop=thumbnail&pithumbsize=960`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'FamKitApp/1.0 (https://famkit.app; contact@famkit.app)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        const pages = Object.values(data.query?.pages || {}) as Array<{
          title: string;
          thumbnail?: { source: string };
        }>;

        const words = cleanTitle.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        const match =
          pages.find((p) => p.thumbnail?.source && words.every((w) => p.title.toLowerCase().includes(w))) ||
          pages.find((p) => p.thumbnail?.source && words.some((w) => p.title.toLowerCase().includes(w)));

        if (match?.thumbnail?.source) {
          return match.thumbnail.source;
        }
      }
    } catch {
      // Fall through to AI generator
    }
  }

  // 3. Check full curated dictionary (sorted by length)
  const allKeys = Object.keys(CURATED_FOOD_IMAGES)
    .filter((k) => k !== 'default')
    .sort((a, b) => b.length - a.length);

  for (const key of allKeys) {
    if (queryText.includes(key)) {
      return CURATED_FOOD_IMAGES[key];
    }
  }

  // 4. Dynamic AI-generated food photography via Pollinations
  const photoPrompt = `${title}, ${description || ''}, plated gourmet food photography, appetizing, high resolution`
    .replace(/[\n\r]+/g, ' ')
    .trim()
    .slice(0, 200);

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(photoPrompt)}?width=800&height=500&nologo=true`;
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
  "ingredients": [{ "item": "ingredient with amount", "category": "Produce" }],
  "instructions": ["Step 1...", "Step 2..."],
  "tags": ["Dinner"]
}

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

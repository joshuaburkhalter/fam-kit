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
  bowl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  banh: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  vietnamese: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  salad: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
  ramen: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
  pasta: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=800&auto=format&fit=crop&q=80',
  spaghetti: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=800&auto=format&fit=crop&q=80',
  chicken: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
  meatball: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&auto=format&fit=crop&q=80',
  beef: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  steak: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  stew: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
  sandwich: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80',
  taco: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  mexican: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  salmon: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  fish: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  seafood: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop&q=80',
  shrimp: 'https://images.unsplash.com/photo-1559742811-822873691df8?w=800&auto=format&fit=crop&q=80',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80',
  cake: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80',
  cookie: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80',
  dessert: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=80',
  pancake: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80',
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&auto=format&fit=crop&q=80',
  curry: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
  rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
  stir: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&auto=format&fit=crop&q=80',
  vegetarian: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&auto=format&fit=crop&q=80',
};

export function getCuratedFoodImage(title: string = '', tags: string[] = []): string {
  const query = `${title} ${tags.join(' ')}`.toLowerCase();
  for (const [key, url] of Object.entries(CURATED_FOOD_IMAGES)) {
    if (key !== 'default' && query.includes(key)) {
      return url;
    }
  }
  return CURATED_FOOD_IMAGES.default;
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

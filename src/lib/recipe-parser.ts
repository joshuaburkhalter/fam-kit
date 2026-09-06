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
  // If in ISO 8601 duration format (e.g. PT1H30M, PT45M)
  const isoMatch = isoOrText.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (isoMatch) {
    const hours = isoMatch[1] ? `${isoMatch[1]} hr` : '';
    const mins = isoMatch[2] ? `${isoMatch[2]} min` : '';
    return [hours, mins].filter(Boolean).join(' ') || isoOrText;
  }
  return isoOrText;
}

export async function parseRecipeFromUrl(url: string, geminiApiKey?: string): Promise<ParsedRecipe> {
  // Fetch HTML with User-Agent header
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 fam-kit/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recipe URL (${response.status}: ${response.statusText})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 1. Try to find schema.org/Recipe in JSON-LD scripts
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
        return false; // Break loop
      }
    } catch {
      // Ignore JSON parse errors in individual tags
    }
  });

  if (recipeSchema) {
    return extractFromJsonLd(recipeSchema, $, url);
  }

  // 2. If no JSON-LD or incomplete, extract via OpenGraph / Microdata & Gemini AI fallback
  return extractWithGeminiFallback(html, $, url, geminiApiKey);
}

function extractFromJsonLd(schema: any, $: cheerio.CheerioAPI, url: string): ParsedRecipe {
  // Title
  const title =
    schema.name ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().replace(/ - .*/, '').trim() ||
    'Imported Recipe';

  // Description
  const description =
    schema.description ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    undefined;

  // Image
  let imageUrl: string | undefined = undefined;
  if (schema.image) {
    if (typeof schema.image === 'string') {
      imageUrl = schema.image;
    } else if (Array.isArray(schema.image) && schema.image[0]) {
      imageUrl = typeof schema.image[0] === 'string' ? schema.image[0] : schema.image[0].url;
    } else if (schema.image.url) {
      imageUrl = schema.image.url;
    }
  }
  if (!imageUrl) {
    imageUrl = $('meta[property="og:image"]').attr('content');
  }

  // Prep, Cook, Total Time
  const prepTime = formatDuration(schema.prepTime);
  const cookTime = formatDuration(schema.cookTime);
  const totalTime = formatDuration(schema.totalTime);

  // Servings
  let servings: string | undefined = undefined;
  if (schema.recipeYield) {
    servings = Array.isArray(schema.recipeYield)
      ? schema.recipeYield[0]?.toString()
      : schema.recipeYield?.toString();
  }

  // Ingredients
  const ingredients: Array<{ item: string; amount?: string; unit?: string; category?: string }> = [];
  const rawIngredients = schema.recipeIngredient || schema.ingredients || [];
  if (Array.isArray(rawIngredients)) {
    for (const raw of rawIngredients) {
      if (typeof raw === 'string' && raw.trim()) {
        ingredients.push({
          item: raw.trim(),
        });
      }
    }
  }

  // Instructions
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

  // Tags
  const tags: string[] = [];
  if (schema.recipeCategory) {
    if (Array.isArray(schema.recipeCategory)) tags.push(...schema.recipeCategory);
    else tags.push(schema.recipeCategory.toString());
  }
  if (schema.recipeCuisine) {
    if (Array.isArray(schema.recipeCuisine)) tags.push(...schema.recipeCuisine);
    else tags.push(schema.recipeCuisine.toString());
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

  const pageTitle =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    'Recipe';
  const pageImage = $('meta[property="og:image"]').attr('content');
  const pageDesc =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content');

  // Remove script, style, nav, footer to reduce tokens
  $('script, style, nav, footer, header, noscript, svg').remove();
  const cleanText = $('body').text().replace(/\s+/g, ' ').slice(0, 15000);

  if (activeKey) {
    try {
      const genAI = new GoogleGenerativeAI(activeKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `Extract the structured recipe from this web page content:
URL: ${url}
Page Title: ${pageTitle}

Return a valid JSON object only, with no markdown code blocks or surrounding text, matching this structure:
{
  "title": "Recipe Title",
  "description": "Short summary",
  "imageUrl": "${pageImage || ''}",
  "prepTime": "15 min",
  "cookTime": "30 min",
  "servings": "4",
  "ingredients": [
    { "item": "full ingredient string with amount", "category": "Produce | Dairy | Meat | Pantry | Bakery | Frozen | Other" }
  ],
  "instructions": [
    "Step 1...",
    "Step 2..."
  ],
  "tags": ["Dinner", "Pasta"]
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
      console.warn('Gemini extraction fallback error:', err);
    }
  }

  // If no Gemini key or error, return best-effort basic metadata
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

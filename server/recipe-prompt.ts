import { GoogleGenerativeAI } from '@google/generative-ai';
import { formatDuration, findAccurateRecipePhoto } from './recipe-parser.js';

export interface PromptRecipeIngredient {
  item: string;
  amount?: string;
  unit?: string;
  category?: string;
}

export interface GeneratedPromptRecipe {
  title: string;
  description?: string;
  category?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  imageUrl?: string;
  tags: string[];
  ingredients: PromptRecipeIngredient[];
  instructions: string[];
  sourceUrl?: string;
}

export async function generateRecipeFromPrompt(params: {
  prompt: string;
  iteration?: number;
  previousTitles?: string[];
  householdId?: string;
  geminiApiKey?: string;
}): Promise<GeneratedPromptRecipe> {
  const activeKey = params.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error('Gemini API key is required to generate recipes from prompt. Please check your settings or server environment.');
  }

  const genAI = new GoogleGenerativeAI(activeKey);
  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash'];

  const previousTitlesNote =
    params.previousTitles && params.previousTitles.length > 0
      ? `\nImportant: The user previously tried and rejected these variations: ${params.previousTitles.map((t) => `"${t}"`).join(', ')}. Please provide a distinct, fresh alternative or different creative spin that still fulfills the user's prompt request.`
      : '';

  const systemInstruction = `You are an expert family chef and meal planning specialist.
The user wants you to create a complete, practical, delicious recipe from a natural language prompt.
Requirements:
1. Return ONLY a valid JSON object matching the exact schema specified. Do not include markdown code fences, markdown prose, or explanations outside the JSON.
2. The recipe should be realistic, delicious, easy to prepare for a family, and accurately match the user's request.
3. Every ingredient MUST be an object with:
   - "item": clean name of the ingredient (e.g. "boneless chicken breasts", "olive oil", "yellow onion")
   - "amount": optional numeric string or fraction (e.g. "2", "1/2", "1.5")
   - "unit": optional common unit (e.g. "lbs", "cups", "tbsp", "tsp", "cloves", "cans", "oz")
   - "category": common grocery aisle (e.g. "Produce", "Meat & Seafood", "Dairy & Refrigerated", "Pantry", "Bakery", "Frozen", "Spices & Seasonings")
4. "instructions": array of step-by-step cooking instruction strings.
5. "category": one of "Dinner", "Lunch", "Breakfast", "Dessert", "Side", "Snack", or "Appetizer".
6. "tags": array of 2-5 relevant tags (e.g. "ai", "quick", "italian", "dinner"). Always include "ai".
7. "prepTimeMinutes": integer minutes (e.g. 15).
8. "cookTimeMinutes": integer minutes (e.g. 30).
9. "servings": integer number of servings (e.g. 4).
10. "imageQuery": a short 3-6 word specific visual food search query that accurately represents this finished dish for photo lookup (e.g. "creamy tuscan chicken pasta bowl").

Schema:
{
  "title": "string",
  "description": "string",
  "category": "Dinner | Lunch | Breakfast | Dessert | Side | Snack | Appetizer",
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "servings": 4,
  "tags": ["ai", "quick", "dinner"],
  "ingredients": [
    { "item": "boneless chicken breasts", "amount": "1.5", "unit": "lbs", "category": "Meat & Seafood" }
  ],
  "instructions": [
    "Pat chicken dry with paper towels and season with salt and pepper."
  ],
  "imageQuery": "creamy tuscan chicken pasta bowl"
}`;

  const promptText = `User Recipe Request: "${params.prompt.trim()}"${previousTitlesNote}
Iteration try: ${params.iteration || 1} of 5.
Generate the recipe JSON now:`;

  let lastError: any = null;
  let parsed: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { text: systemInstruction },
        { text: promptText },
      ]);
      const text = result.response.text().trim();
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      if (parsed && parsed.title) {
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Recipe Prompt] Model ${modelName} attempt failed:`, err);
    }
  }

  if (!parsed || !parsed.title) {
    throw new Error(
      lastError?.message || 'Could not generate a recipe from this prompt. Please try rephrasing your request.'
    );
  }

  // Format ingredients
  const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  const formattedIngredients: PromptRecipeIngredient[] = rawIngredients
    .map((ing: any) => {
      if (typeof ing === 'string') return { item: ing.trim() };
      return {
        item: String(ing.item || ing.name || '').trim(),
        amount: ing.amount ? String(ing.amount).trim() : undefined,
        unit: ing.unit ? String(ing.unit).trim() : undefined,
        category: ing.category ? String(ing.category).trim() : undefined,
      };
    })
    .filter((ing: any) => Boolean(ing.item));

  // Format instructions
  const rawInstructions = Array.isArray(parsed.instructions) ? parsed.instructions : [];
  const formattedInstructions: string[] = rawInstructions
    .map((inst: any) => String(inst).trim())
    .filter(Boolean);

  // Tags
  const tagSet = new Set<string>();
  tagSet.add('ai');
  if (Array.isArray(parsed.tags)) {
    for (const t of parsed.tags) {
      if (typeof t === 'string' && t.trim()) {
        tagSet.add(t.trim().replace(/^#/, ''));
      }
    }
  }
  const tags = Array.from(tagSet);

  // Accurate food photo resolution
  let imageUrl: string | undefined = undefined;
  try {
    const keyIngredients = formattedIngredients.slice(0, 4).map((i) => i.item);
    const fallbackQuery = `${parsed.title} with ${keyIngredients.join(', ')}`;
    const imageQuery = parsed.imageQuery || fallbackQuery;
    imageUrl = await findAccurateRecipePhoto(
      parsed.title,
      parsed.description || '',
      tags,
      imageQuery,
      new Set<string>(),
      formattedIngredients
    );
  } catch (imgErr) {
    console.warn('[Recipe Prompt] Photo search error:', imgErr);
  }

  const prepTimeMinutes =
    typeof parsed.prepTimeMinutes === 'number'
      ? parsed.prepTimeMinutes
      : parsed.prepTime
      ? parseInt(String(parsed.prepTime).replace(/[^0-9]/g, ''), 10) || undefined
      : undefined;

  const cookTimeMinutes =
    typeof parsed.cookTimeMinutes === 'number'
      ? parsed.cookTimeMinutes
      : parsed.cookTime
      ? parseInt(String(parsed.cookTime).replace(/[^0-9]/g, ''), 10) || undefined
      : undefined;

  const servings =
    typeof parsed.servings === 'number'
      ? parsed.servings
      : parsed.servings
      ? parseInt(String(parsed.servings).replace(/[^0-9]/g, ''), 10) || undefined
      : 4;

  return {
    title: String(parsed.title).trim(),
    description: parsed.description ? String(parsed.description).trim() : undefined,
    category: parsed.category ? String(parsed.category).trim() : 'Dinner',
    prepTimeMinutes,
    cookTimeMinutes,
    servings,
    imageUrl,
    tags,
    ingredients: formattedIngredients,
    instructions: formattedInstructions,
    sourceUrl: 'Created by Prompt',
  };
}

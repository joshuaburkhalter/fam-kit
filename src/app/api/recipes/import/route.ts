import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseRecipeFromUrl } from '@/lib/recipe-parser';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { url, apiKey } = body;

    if (!url) {
      return NextResponse.json({ error: 'Recipe URL is required' }, { status: 400 });
    }

    // Clean URL
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    const parsed = await parseRecipeFromUrl(targetUrl, apiKey);

    // Save to database
    const savedRecipe = await prisma.recipe.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        imageUrl: parsed.imageUrl,
        prepTime: parsed.prepTime,
        cookTime: parsed.cookTime,
        servings: parsed.servings,
        sourceUrl: parsed.sourceUrl || targetUrl,
        ingredients: JSON.stringify(parsed.ingredients),
        instructions: JSON.stringify(parsed.instructions),
        tags: (parsed.tags || []).join(', '),
        householdId,
      },
    });

    return NextResponse.json({
      success: true,
      recipe: savedRecipe,
      parsed,
    });
  } catch (error: any) {
    console.error('Recipe import API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to import recipe from URL',
      },
      { status: 500 }
    );
  }
}

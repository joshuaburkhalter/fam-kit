import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

// GET: list all recipes
export async function GET(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    const recipes = await prisma.recipe.findMany({
      where: {
        householdId,
        ...(query && {
          OR: [
            { title: { contains: query } },
            { tags: { contains: query } },
            { description: { contains: query } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(recipes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create or update recipe manually
export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { id, title, description, imageUrl, prepTime, cookTime, servings, sourceUrl, ingredients, instructions, tags } = body;

    if (!title) {
      return NextResponse.json({ error: 'Recipe title is required' }, { status: 400 });
    }

    const payload = {
      title,
      description,
      imageUrl,
      prepTime,
      cookTime,
      servings,
      sourceUrl,
      ingredients: typeof ingredients === 'string' ? ingredients : JSON.stringify(ingredients || []),
      instructions: typeof instructions === 'string' ? instructions : JSON.stringify(instructions || []),
      tags: Array.isArray(tags) ? tags.join(', ') : tags,
      householdId,
    };

    if (id) {
      const updated = await prisma.recipe.update({
        where: { id },
        data: payload,
      });
      return NextResponse.json(updated);
    }

    const created = await prisma.recipe.create({
      data: payload,
    });

    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: delete recipe
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
    }

    await prisma.recipe.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

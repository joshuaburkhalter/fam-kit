import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

// GET: fetch meal plans for date range (e.g. startDate to endDate)
export async function GET(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const mealPlans = await prisma.mealPlan.findMany({
      where: {
        householdId,
        ...(startDate && endDate && {
          date: {
            gte: startDate,
            lte: endDate,
          },
        }),
      },
      include: {
        recipe: true,
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    });

    return NextResponse.json(mealPlans);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Upsert meal plan slot or export ingredients to grocery list
export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { action, date, mealType, title, notes, recipeId, ingredients, addedById } = body;

    // Action: Export ingredients to grocery list
    if (action === 'export_ingredients' && ingredients && Array.isArray(ingredients)) {
      const aisles = await prisma.aisleCategory.findMany({
        where: { householdId },
      });

      const createdItems = [];
      for (const rawIng of ingredients) {
        let name = '';
        let category = 'Other';

        if (typeof rawIng === 'string') {
          name = rawIng;
        } else if (typeof rawIng === 'object' && rawIng.item) {
          name = rawIng.item;
          category = rawIng.category || 'Other';
        }

        if (!name) continue;

        // Find matching aisle
        const matchedAisle = aisles.find(
          (a) =>
            a.name.toLowerCase().includes(category.toLowerCase()) ||
            category.toLowerCase().includes(a.name.toLowerCase())
        ) || aisles.find((a) => a.name === 'Other') || aisles[0];

        const created = await prisma.groceryItem.create({
          data: {
            name,
            category: matchedAisle?.name || category || 'Other',
            aisleId: matchedAisle?.id,
            checked: false,
            householdId,
            addedById,
          },
        });
        createdItems.push(created);
      }

      return NextResponse.json({
        success: true,
        count: createdItems.length,
        items: createdItems,
      });
    }

    // Default: Set/update meal plan slot
    if (!date || !mealType || !title) {
      return NextResponse.json({ error: 'Date, mealType, and title are required' }, { status: 400 });
    }

    const mealPlan = await prisma.mealPlan.upsert({
      where: {
        householdId_date_mealType: {
          householdId,
          date,
          mealType,
        },
      },
      update: {
        title,
        notes,
        recipeId: recipeId || null,
      },
      create: {
        date,
        mealType,
        title,
        notes,
        recipeId: recipeId || null,
        householdId,
      },
      include: {
        recipe: true,
      },
    });

    return NextResponse.json(mealPlan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: clear a meal plan slot
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'MealPlan ID is required' }, { status: 400 });
    }

    await prisma.mealPlan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

// GET: fetch grocery items (and custom lists)
export async function GET(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const { searchParams } = new URL(req.url);
    const listId = searchParams.get('listId');

    const [items, lists, aisles] = await Promise.all([
      prisma.groceryItem.findMany({
        where: {
          householdId,
          listId: listId ? listId : null,
        },
        include: {
          aisle: true,
          addedBy: true,
        },
        orderBy: [{ checked: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.customList.findMany({
        where: { householdId },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.aisleCategory.findMany({
        where: { householdId },
        orderBy: { orderIndex: 'asc' },
      }),
    ]);

    return NextResponse.json({
      items,
      lists,
      aisles,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Add grocery item(s)
export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { name, category, quantity, unit, note, listId, addedById, items } = body;

    if (items && Array.isArray(items)) {
      // Bulk add
      const created = await Promise.all(
        items.map(async (i: any) => {
          let aisleId = i.aisleId;
          if (!aisleId && i.category) {
            const match = await prisma.aisleCategory.findFirst({
              where: { householdId, name: i.category },
            });
            aisleId = match?.id;
          }
          return prisma.groceryItem.create({
            data: {
              name: i.name,
              category: i.category || 'Other',
              aisleId,
              quantity: i.quantity || '1',
              unit: i.unit,
              note: i.note,
              householdId,
              listId: i.listId || null,
              addedById: i.addedById || null,
            },
          });
        })
      );
      return NextResponse.json({ items: created });
    }

    // Single item
    if (!name) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    let aisleId = body.aisleId;
    let finalCategory = category || 'Other';
    if (!aisleId) {
      const match = await prisma.aisleCategory.findFirst({
        where: {
          householdId,
          name: {
            contains: finalCategory,
          },
        },
      });
      aisleId = match?.id;
    }

    const item = await prisma.groceryItem.create({
      data: {
        name,
        category: finalCategory,
        aisleId,
        quantity: quantity || '1',
        unit,
        note,
        householdId,
        listId: listId || null,
        addedById: addedById || null,
      },
      include: {
        aisle: true,
        addedBy: true,
      },
    });

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update item (toggle checked, edit quantity/category/note)
export async function PATCH(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { id, checked, name, quantity, unit, note, category, aisleId, batchCheck } = body;

    if (batchCheck && Array.isArray(batchCheck.ids)) {
      await prisma.groceryItem.updateMany({
        where: {
          id: { in: batchCheck.ids },
          householdId,
        },
        data: {
          checked: batchCheck.checked,
        },
      });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'Item id is required' }, { status: 400 });
    }

    const updated = await prisma.groceryItem.update({
      where: { id },
      data: {
        ...(checked !== undefined && { checked }),
        ...(name !== undefined && { name }),
        ...(quantity !== undefined && { quantity }),
        ...(unit !== undefined && { unit }),
        ...(note !== undefined && { note }),
        ...(category !== undefined && { category }),
        ...(aisleId !== undefined && { aisleId }),
      },
      include: {
        aisle: true,
        addedBy: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete single item or clear completed items
export async function DELETE(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const clearChecked = searchParams.get('clearChecked');
    const listId = searchParams.get('listId');

    if (clearChecked === 'true') {
      const result = await prisma.groceryItem.deleteMany({
        where: {
          householdId,
          checked: true,
          listId: listId ? listId : null,
        },
      });
      return NextResponse.json({ count: result.count });
    }

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    await prisma.groceryItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

// GET: list all aisles for household
export async function GET(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const aisles = await prisma.aisleCategory.findMany({
      where: { householdId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return NextResponse.json(aisles);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create new custom aisle
export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const { name, icon } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Aisle name is required' }, { status: 400 });
    }

    // Determine highest orderIndex
    const lastAisle = await prisma.aisleCategory.findFirst({
      where: { householdId },
      orderBy: { orderIndex: 'desc' },
    });

    const newIndex = (lastAisle?.orderIndex ?? -1) + 1;

    const aisle = await prisma.aisleCategory.create({
      data: {
        name,
        icon: icon || '🛒',
        orderIndex: newIndex,
        isDefault: false,
        householdId,
      },
    });

    return NextResponse.json(aisle);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Reorder aisles in batch or update an aisle
export async function PUT(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { aisleOrders, id, name, icon } = body;

    // Batch reorder: array of { id, orderIndex }
    if (aisleOrders && Array.isArray(aisleOrders)) {
      const updates = aisleOrders.map((item: { id: string; orderIndex: number }) =>
        prisma.aisleCategory.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        })
      );
      await prisma.$transaction(updates);

      const refreshed = await prisma.aisleCategory.findMany({
        where: { householdId },
        orderBy: { orderIndex: 'asc' },
      });

      return NextResponse.json(refreshed);
    }

    // Single aisle update
    if (id) {
      const updated = await prisma.aisleCategory.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(icon && { icon }),
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete aisle (items in this aisle get reset to Other)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Aisle ID is required' }, { status: 400 });
    }

    await prisma.aisleCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

// GET: get current household details and members
export async function GET(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);

    const household = await prisma.household.findUnique({
      where: { id: householdId },
      include: {
        members: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!household) {
      // Fallback: create default household if none exists
      const newHousehold = await prisma.household.create({
        data: {
          name: 'My Family',
          inviteCode: 'FAMKIT',
          members: {
            create: {
              name: 'Joshua',
              avatar: '👨‍💻',
              color: '#6366f1',
              role: 'Parent',
            },
          },
        },
        include: { members: true },
      });
      return NextResponse.json(newHousehold);
    }

    return NextResponse.json(household);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Add new member or join household via invite code or update household
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, inviteCode, name, avatar, color, role, householdName } = body;

    // Join family with invite code
    if (action === 'join_with_code' && inviteCode) {
      const found = await prisma.household.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() },
        include: { members: true },
      });

      if (!found) {
        return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
      }

      // Add user to this household if name provided
      if (name) {
        const newMember = await prisma.user.create({
          data: {
            name,
            avatar: avatar || '👤',
            color: color || '#6366f1',
            role: role || 'Member',
            householdId: found.id,
          },
        });
        const updatedHousehold = await prisma.household.findUnique({
          where: { id: found.id },
          include: { members: true },
        });
        return NextResponse.json({ household: updatedHousehold, newMember });
      }

      return NextResponse.json({ household: found });
    }

    const householdId = await getHouseholdId(req);

    // Update household name
    if (action === 'update_name' && householdName) {
      const updated = await prisma.household.update({
        where: { id: householdId },
        data: { name: householdName },
        include: { members: true },
      });
      return NextResponse.json(updated);
    }

    // Add new member to current household
    if (name) {
      const newMember = await prisma.user.create({
        data: {
          name,
          avatar: avatar || '👤',
          color: color || '#10b981',
          role: role || 'Member',
          householdId,
        },
      });

      return NextResponse.json(newMember);
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: remove family member
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPushNotificationToHousehold } from '@/lib/push';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

// GET: list events (optionally filtered by month, date range, or member)
export async function GET(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const memberId = searchParams.get('memberId');

    const events = await prisma.calendarEvent.findMany({
      where: {
        householdId,
        ...(startDate && endDate && {
          date: {
            gte: startDate,
            lte: endDate,
          },
        }),
        ...(memberId && memberId !== 'all' && {
          assignedMemberId: memberId,
        }),
      },
      include: {
        assignedMember: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(events);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create or update calendar event
export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { id, title, description, date, startTime, endTime, allDay, category, color, location, assignedMemberId } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and Date are required' }, { status: 400 });
    }

    const payload = {
      title,
      description,
      date,
      startTime: startTime || null,
      endTime: endTime || null,
      allDay: Boolean(allDay),
      category: category || 'Family',
      color: color || '#6366f1',
      location,
      assignedMemberId: assignedMemberId || null,
      householdId,
    };

    if (id) {
      const updated = await prisma.calendarEvent.update({
        where: { id },
        data: payload,
        include: { assignedMember: true },
      });
      return NextResponse.json(updated);
    }

    const created = await prisma.calendarEvent.create({
      data: payload,
      include: { assignedMember: true },
    });

    // Send push notification
    sendPushNotificationToHousehold(householdId, {
      title: `📅 Event: ${title}`,
      body: `Scheduled for ${date}${startTime ? ` at ${startTime}` : ''}`,
      url: '/calendar',
    });

    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: delete calendar event
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    await prisma.calendarEvent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

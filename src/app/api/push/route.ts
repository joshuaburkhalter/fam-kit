import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { vapidPublicKey, sendPushNotificationToHousehold } from '@/lib/push';

async function getHouseholdId(req: NextRequest): Promise<string> {
  const headerHouseholdId = req.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;
  const first = await prisma.household.findFirst();
  return first?.id || 'default-household';
}

// GET: returns public VAPID key
export async function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey });
}

// POST: Save push subscription or send test notification
export async function POST(req: NextRequest) {
  try {
    const householdId = await getHouseholdId(req);
    const body = await req.json();
    const { action, subscription, userId, title, message } = body;

    // Trigger test notification
    if (action === 'test_notification') {
      await sendPushNotificationToHousehold(householdId, {
        title: title || '🌟 fam-kit Notification',
        body: message || 'Push notifications are working perfectly on your device!',
        url: '/',
      });
      return NextResponse.json({ success: true, message: 'Notification triggered' });
    }

    // Save Subscription
    if (subscription && subscription.endpoint && subscription.keys) {
      const keysStr = JSON.stringify(subscription.keys);

      const saved = await prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          keys: keysStr,
          userId: userId || null,
          householdId,
        },
        create: {
          endpoint: subscription.endpoint,
          keys: keysStr,
          userId: userId || null,
          householdId,
        },
      });

      return NextResponse.json({ success: true, id: saved.id });
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  } catch (error: any) {
    console.error('Push subscription error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

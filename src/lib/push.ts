import webPush from 'web-push';
import { prisma } from './db';

// Generate VAPID keys if not set in environment or use defaults
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'UUxI2O4-Fb_s_bvyYl3TfQ14sJtH0k6sBw8-kLgqDQE';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:hello@famkit.app';

try {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} catch (e) {
  console.warn('VAPID initialization note:', e);
}

export { vapidPublicKey };

export async function sendPushNotificationToHousehold(
  householdId: string,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
  }
) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { householdId },
    });

    const notifications = subscriptions.map(async (sub) => {
      try {
        const keys = JSON.parse(sub.keys);
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys,
        };

        await webPush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icons/icon-192.png',
            badge: payload.badge || '/icons/icon-192.png',
            data: {
              url: payload.url || '/',
            },
            tag: payload.tag || 'fam-kit-notification',
          })
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or invalid -> delete it
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          });
        }
      }
    });

    await Promise.allSettled(notifications);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

import webPush from 'web-push';
import { queryOne, queryAll, execute } from './db.js';

export const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'UUxI2O4-Fb_s_bvyYl3TfQ14sJtH0k6sBw8-kLgqDQE';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:hello@famkit.app';

try {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} catch (e) {
  console.warn('VAPID initialization note:', e);
}

export type NotificationCategory =
  | 'grocery_added'
  | 'grocery_completed'
  | 'calendar_events'
  | 'meal_plans'
  | 'recipes_added'
  | 'assistant_actions'
  | 'test';

export interface UserNotificationPreferences {
  userId: string;
  householdId: string;
  groceryAdded: boolean;
  groceryCompleted: boolean;
  calendarEvents: boolean;
  mealPlans: boolean;
  recipesAdded: boolean;
  assistantActions: boolean;
  notifyOwnActions: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt?: string;
}

export function getDefaultNotificationPreferences(
  userId: string,
  householdId: string
): UserNotificationPreferences {
  return {
    userId,
    householdId,
    groceryAdded: true,
    groceryCompleted: true,
    calendarEvents: true,
    mealPlans: true,
    recipesAdded: true,
    assistantActions: true,
    notifyOwnActions: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    updatedAt: new Date().toISOString(),
  };
}

export function getNotificationPreferences(
  userId: string,
  householdId: string
): UserNotificationPreferences {
  const row = queryOne<any>(
    'SELECT * FROM notification_preferences WHERE userId = ?',
    [userId]
  );

  if (!row) {
    return getDefaultNotificationPreferences(userId, householdId);
  }

  return {
    userId: row.userId,
    householdId: row.householdId || householdId,
    groceryAdded: Boolean(row.groceryAdded),
    groceryCompleted: Boolean(row.groceryCompleted),
    calendarEvents: Boolean(row.calendarEvents),
    mealPlans: Boolean(row.mealPlans),
    recipesAdded: Boolean(row.recipesAdded),
    assistantActions: Boolean(row.assistantActions),
    notifyOwnActions: Boolean(row.notifyOwnActions),
    quietHoursEnabled: Boolean(row.quietHoursEnabled),
    quietHoursStart: row.quietHoursStart || '22:00',
    quietHoursEnd: row.quietHoursEnd || '07:00',
    updatedAt: row.updatedAt,
  };
}

export function saveNotificationPreferences(
  userId: string,
  householdId: string,
  prefs: Partial<UserNotificationPreferences>
): UserNotificationPreferences {
  const existing = getNotificationPreferences(userId, householdId);
  const updated: UserNotificationPreferences = {
    ...existing,
    ...prefs,
    userId,
    householdId,
    updatedAt: new Date().toISOString(),
  };

  execute(
    `INSERT OR REPLACE INTO notification_preferences (
      userId, householdId, groceryAdded, groceryCompleted, calendarEvents,
      mealPlans, recipesAdded, assistantActions, notifyOwnActions,
      quietHoursEnabled, quietHoursStart, quietHoursEnd, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      updated.userId,
      updated.householdId,
      updated.groceryAdded ? 1 : 0,
      updated.groceryCompleted ? 1 : 0,
      updated.calendarEvents ? 1 : 0,
      updated.mealPlans ? 1 : 0,
      updated.recipesAdded ? 1 : 0,
      updated.assistantActions ? 1 : 0,
      updated.notifyOwnActions ? 1 : 0,
      updated.quietHoursEnabled ? 1 : 0,
      updated.quietHoursStart,
      updated.quietHoursEnd,
      updated.updatedAt,
    ]
  );

  return updated;
}

export function isQuietHours(startStr: string, endStr: string, date: Date = new Date()): boolean {
  if (!startStr || !endStr) return false;
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  const [startH, startM] = startStr.split(':').map((s) => parseInt(s, 10));
  const [endH, endM] = endStr.split(':').map((s) => parseInt(s, 10));

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return false;

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Over midnight, e.g. 22:00 to 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export async function sendPushNotificationToHousehold(
  householdId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
  options?: {
    category?: NotificationCategory;
    actorUserId?: string;
  }
) {
  try {
    const subscriptions = queryAll<{ id: string; endpoint: string; keys: string; userId: string | null }>(
      'SELECT * FROM push_subscriptions WHERE householdId = ?',
      [householdId]
    );

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const category = options?.category;
    const actorUserId = options?.actorUserId;

    const notifications = subscriptions.map(async (sub) => {
      try {
        // If this subscription belongs to a specific user, check their notification preferences
        if (sub.userId) {
          // Check if sender is actor and does not want self notifications
          const prefs = getNotificationPreferences(sub.userId, householdId);

          if (actorUserId && sub.userId === actorUserId && !prefs.notifyOwnActions) {
            return;
          }

          // Category filter check (test notifications bypass category filter)
          if (category && category !== 'test') {
            if (category === 'grocery_added' && !prefs.groceryAdded) return;
            if (category === 'grocery_completed' && !prefs.groceryCompleted) return;
            if (category === 'calendar_events' && !prefs.calendarEvents) return;
            if (category === 'meal_plans' && !prefs.mealPlans) return;
            if (category === 'recipes_added' && !prefs.recipesAdded) return;
            if (category === 'assistant_actions' && !prefs.assistantActions) return;
          }

          // Quiet hours check (test notifications bypass quiet hours)
          if (category !== 'test' && prefs.quietHoursEnabled) {
            if (isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)) {
              return;
            }
          }
        }

        const keys = JSON.parse(sub.keys);
        const pushSubscription = { endpoint: sub.endpoint, keys };

        await webPush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            data: { url: payload.url || '/' },
            tag: payload.tag || 'fam-kit-notification',
          })
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        } else {
          console.error('Failed to send push to subscription:', sub.id, err?.message || err);
        }
      }
    });

    await Promise.allSettled(notifications);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Service Worker Push & Notification Click Handlers
// This script is imported by the main Workbox service worker

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  // Always wrap in event.waitUntil to guarantee Chromium's userVisibleOnly contract is satisfied
  event.waitUntil(
    (async () => {
      let payload = {
        title: 'Homebase Notification',
        body: 'You have a new update in Homebase',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: '/' },
        tag: 'homebase-update-' + Date.now(),
      };

      if (event.data) {
        try {
          const json = event.data.json();
          if (json && typeof json === 'object') {
            payload = { ...payload, ...json };
          }
        } catch {
          try {
            const text = event.data.text();
            if (text) {
              payload.body = text;
            }
          } catch {}
        }
      }

      // Ensure title and body are non-empty strings
      const title = (payload.title && String(payload.title).trim()) || 'Homebase';
      const body = (payload.body && String(payload.body).trim()) || 'You have a new update in Homebase';

      // 1. Try displaying with rich options
      try {
        const options = {
          body,
          icon: payload.icon || '/icons/icon-192.png',
          badge: payload.badge || '/icons/icon-192.png',
          data: payload.data || { url: '/' },
          tag: String(payload.tag || 'homebase-notification'),
        };

        // Note: Some platforms reject if vibrate or renotify are included when backgrounded
        try {
          if (Array.isArray(payload.vibrate)) {
            options.vibrate = payload.vibrate;
          }
          if (payload.renotify) {
            options.renotify = Boolean(payload.renotify);
          }
        } catch {}

        await self.registration.showNotification(title, options);
        return;
      } catch (primaryErr) {
        console.warn('[SW Push] Primary showNotification failed, attempting minimal fallback:', primaryErr);
      }

      // 2. Fallback to minimal notification options that are universally supported across all browsers
      try {
        await self.registration.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          data: { url: (payload.data && payload.data.url) || '/' },
        });
      } catch (fallbackErr) {
        console.error('[SW Push] Fatal showNotification fallback error:', fallbackErr);
        // Absolute last resort to satisfy Chromium's userVisibleOnly constraint
        try {
          await self.registration.showNotification('Homebase', {
            body: 'New update available',
          });
        } catch {}
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate to targetUrl
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

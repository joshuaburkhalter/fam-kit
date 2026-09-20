let isReloading = false;
let initialBuildId: string | null = null;

/**
 * Strips the cache-busting `_v` query parameter from the URL if present,
 * keeping the browser address bar clean after an automatic reload.
 */
export function cleanupReloadUrlParam(): void {
  try {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('_v')) {
      url.searchParams.delete('_v');
      const cleanPath = url.pathname + (url.search ? url.search : '') + url.hash;
      window.history.replaceState(null, '', cleanPath);
    }
  } catch (err) {
    console.debug('Error cleaning reload URL param:', err);
  }
}

/**
 * Performs a true hard reload:
 * 1. Clears CacheStorage caches (Workbox, precaches)
 * 2. Updates active service workers
 * 3. Navigates with a cache-busting timestamp parameter to force browser bypass of disk cache
 */
export async function forceAppHardReload(): Promise<void> {
  if (isReloading) return;

  // Prevent reload loops if a reload happened in the last 8 seconds
  const lastReload = Number(sessionStorage.getItem('famkit_last_hard_reload') || '0');
  const now = Date.now();
  if (now - lastReload < 8000) {
    return;
  }

  isReloading = true;
  sessionStorage.setItem('famkit_last_hard_reload', String(now));

  try {
    // Clear all service worker caches
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch (err) {
    console.debug('Error clearing caches during hard reload:', err);
  }

  try {
    // Update service worker registrations
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.update().catch(() => {})));
    }
  } catch (err) {
    console.debug('Error updating service worker during hard reload:', err);
  }

  // Force cache-busting navigation reload via URL query param
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Records or checks the current build ID against the server.
 * If a new build is detected and a prior build ID was already recorded in this session,
 * triggers an immediate forceAppHardReload().
 */
export function handleServerBuildId(newBuildId: string | null | undefined): void {
  if (!newBuildId) return;

  if (!initialBuildId) {
    // First time discovering build ID during this session
    initialBuildId = newBuildId;
    return;
  }

  // If server build ID changed while the app was running, a new Render deploy just finished!
  if (initialBuildId !== newBuildId) {
    console.log(`[Version] New build detected (${initialBuildId} -> ${newBuildId}). Refreshing app...`);
    forceAppHardReload();
  }
}

/**
 * Queries the server version endpoint to detect if a new deploy has landed.
 */
export async function checkServerVersion(): Promise<void> {
  try {
    const res = await fetch(`/api/version?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.buildId) {
        handleServerBuildId(data.buildId);
      }
    }
  } catch {
    // Server may be momentarily rebooting during deploy, will recheck on next interval
  }
}

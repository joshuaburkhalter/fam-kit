let isReloading = false;

/**
 * Strips the cache-busting `_v` query parameter from the URL if present,
 * cleaning up any leftover parameters from prior refreshes.
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
 * Cleanly and safely reloads the application.
 * With Express sending Cache-Control: no-cache, no-store, must-revalidate on index.html and sw.js,
 * a standard reload always fetches the latest app shell safely without:
 * - Wiping active CSS/JS from Workbox caches (prevents plain HTML / FOUC)
 * - Appending query string timestamps (prevents Cloudflare URL routing errors)
 */
export function safeAppReload(): void {
  if (isReloading) return;

  // Prevent multiple rapid reload calls (10s debounce)
  const lastReload = Number(sessionStorage.getItem('famkit_last_reload') || '0');
  const now = Date.now();
  if (now - lastReload < 10000) {
    return;
  }

  isReloading = true;
  sessionStorage.setItem('famkit_last_reload', String(now));

  // Perform a clean reload
  window.location.reload();
}

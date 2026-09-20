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
 * Cleanly reloads the application.
 */
export function reloadApp(): void {
  window.location.reload();
}

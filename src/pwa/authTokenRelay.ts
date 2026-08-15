/**
 * Pushes the current access token into the active service worker, so
 * `sw.js`'s fetch handler can attach it to `/voice-notes/*\/stream`
 * requests — see that file's own doc comment on why the token cannot
 * simply be read there instead (a service worker has no access to this
 * tab's in-memory JS state).
 *
 * Called from `tokenStore.ts`'s `setAccessToken`/`clearAccessToken` —
 * the one place every path that changes the token (login, proactive
 * refresh, 401 recovery, logout) already goes through, so relaying from
 * there covers all of them without touching every call site.
 */
export function relayAuthTokenToServiceWorker(token: string | null): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const controller = navigator.serviceWorker.controller;
  if (!controller) return;

  controller.postMessage({ type: 'AUTH_TOKEN', token });
}

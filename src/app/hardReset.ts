import { closeAuthDatabase } from '@/features/auth/tokenStore';
import { db } from '@/features/notes/local/database';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { requestSync } from '@/sync/engine';
import { EVER_STANDALONE_STORAGE_KEY } from '@/pwa/displayMode';

/**
 * "Reset this device" — a full local teardown, reachable from the Sessions
 * page's danger zone.
 *
 * Two SEPARATE steps on purpose, not one function: `attemptFinalSync` is
 * safe to call and inspect before anything destructive happens (it commits
 * to nothing), while `wipeLocalState` is the point of no return. The caller
 * (SessionsPage) uses the gap between them to warn a person with unsynced
 * work that resetting now will lose it, rather than silently discarding
 * drafts nobody chose to abandon.
 */

export interface FinalSyncResult {
  /**
   * True when local edits the server has not accepted still exist after
   * the attempt — e.g. this device is offline, or the sync run failed. The
   * caller must not treat a hung/offline sync as silent success.
   */
  hadUnsyncedChanges: boolean;
}

/**
 * Runs one push-then-pull cycle through the existing sync engine and waits
 * for it to settle, then reports whether anything local is still unsent.
 *
 * Deliberately does not throw: a network failure here is exactly the
 * outcome the caller needs to see and act on (via `hadUnsyncedChanges`),
 * not an exception to propagate past a confirmation dialog.
 *
 * NOTE: this can only flush what already made it into Dexie/the outbox —
 * an editor that has typed changes not yet autosaved (still short of its
 * own debounce) is outside this function's reach. That is an inherent
 * limit of running this from the Sessions page rather than from inside an
 * open editor, not something this function can compensate for.
 */
export async function attemptFinalSync(ownerId: number | null): Promise<FinalSyncResult> {
  if (ownerId !== null) {
    try {
      await requestSync('manual-reset');
    } catch {
      // Swallowed — the dirty/outbox check below is what actually decides
      // whether this counts as a clean sync, not whether requestSync threw.
    }
  }

  const [dirtyRows, queuedCount] = await Promise.all([
    noteRepository.listDirty(),
    outboxRepository.count(),
  ]);

  return { hadUnsyncedChanges: dirtyRows.length > 0 || queuedCount > 0 };
}

/**
 * Deletes every trace of Notare from this browser: both IndexedDB
 * databases (the notes store and the auth store), every entry this app's
 * service worker ever cached, every service worker registration for this
 * origin, and both Web Storage areas.
 *
 * Does NOT call the server's logout endpoint — that is `AuthProvider`'s
 * `logout()`, and the caller is expected to have already awaited it before
 * calling this. Ordering matters: logout needs a live refresh token to
 * revoke the server-side session, and this function is about to delete the
 * database that token lives in. Calling this first would leave the server
 * session dangling with nothing left locally that could ever revoke it.
 *
 * Every step here is best-effort and swallows its own failures — the goal
 * is the CLEANEST slate achievable, not an all-or-nothing transaction. A
 * cache that fails to delete or a database blocked by another tab must
 * never stop the rest of the teardown from running.
 */
export async function wipeLocalState(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister().catch(() => false)),
      );
    } catch {
      // No service worker support, or getRegistrations() itself failing —
      // either way there is nothing more to do here.
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
    } catch {
      // Cache Storage unavailable — nothing to clear.
    }
  }

  await deleteAllDatabases();

  try {
    /*
     * Whether THIS BROWSER has ever installed the app is not "app data"
     * the way notes, drafts, and cached files are — it is closer to an
     * OS-level fact, the same category as a home-screen icon actually
     * existing. "Reset this device" promises a clean slate for the
     * former; it was never meant to make an already-installed person
     * relitigate the mandatory install gate on their very next load, so
     * this one key survives the otherwise-total clear below.
     */
    const everStandaloneFlag = localStorage.getItem(EVER_STANDALONE_STORAGE_KEY);
    localStorage.clear();
    if (everStandaloneFlag !== null) {
      localStorage.setItem(EVER_STANDALONE_STORAGE_KEY, everStandaloneFlag);
    }
  } catch {
    // Unavailable in some private-browsing modes — nothing more to do.
  }

  try {
    sessionStorage.clear();
  } catch {
    // Same as above.
  }
}

/**
 * The app's two known databases, by name, PLUS anything `indexedDB.databases()`
 * can enumerate.
 *
 * Named deletion is the reliable path — `indexedDB.databases()` is not
 * implemented everywhere this app runs (notably older Safari), so relying on
 * enumeration alone could silently leave the notes or auth store behind on
 * exactly the browsers most likely to need this. Enumeration is additive: it
 * only ever adds names to delete, never replaces the known two.
 */
async function deleteAllDatabases(): Promise<void> {
  /*
   * CLOSE BEFORE DELETE — not optional. A `deleteDatabase` request does not
   * complete while any connection to that database is still open; it only
   * fires 'blocked' and then WAITS, indefinitely, for every connection to
   * close. Both of this app's own databases have exactly such a connection
   * held open for this tab's entire lifetime by design — the Dexie
   * singleton (`database.ts`'s own doc comment) and tokenStore.ts's cached
   * `dbPromise` — so without closing them first, this "reset now" button
   * would silently do nothing until the tab happened to reload or close on
   * its own, which defeats the entire point.
   */
  db.close();
  await closeAuthDatabase();

  const knownNames = [db.name, 'notare-auth', 'notare-sw'];

  let enumeratedNames: string[] = [];
  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    try {
      const entries = await indexedDB.databases();
      enumeratedNames = entries
        .map((entry) => entry.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);
    } catch {
      // Enumeration failing is not fatal — the two known names still get deleted.
    }
  }

  const names = new Set([...knownNames, ...enumeratedNames]);

  await Promise.all([...names].map((name) => deleteDatabase(name)));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    // Every branch resolves rather than rejects — see wipeLocalState's own
    // doc comment on why this is best-effort throughout. `onblocked` fires
    // when another tab still has the database open; the delete completes
    // once that tab's connection closes, which this caller cannot force
    // and should not hang the whole reset waiting for.
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      resolve();
    };
    request.onblocked = () => {
      resolve();
    };
  });
}

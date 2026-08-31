import { relayAuthTokenToServiceWorker } from '@/pwa/authTokenRelay';

/**
 * Where tokens live. Three storage decisions, three different answers.
 *
 * ACCESS TOKEN — memory only. It lives fifteen minutes; persisting it buys one
 * avoided refresh on reload and permanently widens the XSS surface.
 *
 * REFRESH TOKEN — IndexedDB (decision D4), and worth being honest about what
 * that does and does not buy. It does NOT survive XSS: an injected script can
 * read IndexedDB. What it does is stay out of the synchronous localStorage
 * sweep commodity token stealers use, and keep the token in the same
 * transactional store as the rest of our persisted state. The real mitigation
 * is a strict CSP and no dangerouslySetInnerHTML. The httpOnly cookie option
 * is the only one that genuinely survives XSS and needs a server change; it
 * stays on the backlog.
 *
 * NOTHING in sessionStorage — per-tab storage would defeat the cross-tab
 * coordination 4D requires.
 *
 * ITS OWN DATABASE, separate from the notes store Step 7 creates. Clearing
 * cached notes must not log you out, and logging out must not wipe unsynced
 * drafts. Separate databases make that structural rather than a rule someone
 * has to remember.
 *
 * Raw IndexedDB rather than pulling Dexie forward: Dexie earns its place on
 * the notes store (schema versions, migrations, multi-table transactions, live
 * queries) and none of those reasons apply to one key in one store with no
 * schema evolution. A dependency should earn its existence where it is used.
 */

const DB_NAME = 'notare-auth';
const DB_VERSION = 1;
const STORE = 'session';
const REFRESH_TOKEN_KEY = 'refreshToken';

/* ---------------------------------------------------------------------------
 * Access token — in memory, for the lifetime of this tab.
 * ------------------------------------------------------------------------ */

let accessToken: string | null = null;

/**
 * When the access token stops being valid, as an epoch millisecond timestamp.
 *
 * 4D refreshes PROACTIVELY at around 80% of the window rather than waiting for
 * a 401. Fewer failed requests, and — more importantly on this server — fewer
 * chances for two requests to hit a 401 simultaneously and race into two
 * refreshes.
 */
let accessTokenExpiresAt: number | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string, expiresInMs: number): void {
  accessToken = token;
  accessTokenExpiresAt = Date.now() + expiresInMs;
  /*
   * Relayed as the FULL header value (`Bearer <token>`), not the bare
   * token — httpAuth.ts's own `headerFor` does this same prefixing for
   * every other request, and sw.js sets whatever it receives directly as
   * the Authorization header without knowing the scheme. One place
   * decides the format; sw.js stays agnostic to it.
   */
  relayAuthTokenToServiceWorker(`Bearer ${token}`);
}

/**
 * True when the access token is missing or close enough to expiry that it is
 * not worth sending.
 *
 * The skew absorbs clock drift between browser and server and the time a
 * request spends in flight — a token with 200ms left is a 401 waiting to
 * happen.
 */
export function isAccessTokenExpiring(skewMs = 30_000): boolean {
  if (accessToken === null || accessTokenExpiresAt === null) return true;
  return Date.now() >= accessTokenExpiresAt - skewMs;
}

export function clearAccessToken(): void {
  accessToken = null;
  accessTokenExpiresAt = null;
  // So a stale/invalidated token never rides along on a voice-stream
  // request made after logout or a terminal refresh failure.
  relayAuthTokenToServiceWorker(null);
}

/* ---------------------------------------------------------------------------
 * Refresh token — IndexedDB, shared across tabs.
 * ------------------------------------------------------------------------ */

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens (and caches) the database.
 *
 * The promise is cached rather than the database, so concurrent callers during
 * startup share ONE open request instead of racing several.
 *
 * IndexedDB is event-based, so every operation is hand-wrapped in a Promise.
 * This is the API Dexie exists to hide, and sixty lines of it is the honest
 * cost of not taking that dependency here.
 */
function openDatabase(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      // Reset so a later attempt can retry rather than being stuck with a
      // permanently rejected cached promise.
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open the auth database.'));
    };

    /*
     * Fires when another tab is holding a connection at an older version and
     * blocking an upgrade. With one version there is nothing to upgrade to, so
     * this is defensive — but a silent hang here would look like the app
     * freezing on startup for no reason.
     */
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('The auth database is blocked by another tab.'));
    };
  });

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = operation(transaction.objectStore(STORE));

        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error ?? new Error('Auth store operation failed.'));
        };

        /*
         * A transaction can abort for reasons no individual request reports —
         * quota exhaustion being the common one. Without this the promise
         * never settles and the caller waits forever.
         */
        transaction.onabort = () => {
          reject(transaction.error ?? new Error('Auth store transaction aborted.'));
        };
      }),
  );
}

/**
 * Returns null when there is no session AND when the store is unreadable.
 *
 * Deliberately conflated: IndexedDB is unavailable in some private-browsing
 * modes and behind some enterprise policies, and in both cases the honest
 * answer is "you are not signed in" rather than a crash on startup. The user
 * can still log in; the session just will not survive a reload.
 */
export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    const value = await runTransaction<unknown>('readonly', (store) =>
      store.get(REFRESH_TOKEN_KEY),
    );
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Persists the refresh token. THROWS on failure, unlike the read above.
 *
 * The asymmetry is deliberate and it matters. 4D's order is: rotate on the
 * server, write the new token HERE, then adopt the new access token. If this
 * write silently failed, the stored token would still be the one the server
 * just invalidated — and the next refresh would present it, which this server
 * treats as token reuse and responds to by DELETING THE SESSION.
 *
 * So a failed write means the session cannot survive a reload, and the caller
 * has to know rather than find out later.
 */
export async function setStoredRefreshToken(token: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(token, REFRESH_TOKEN_KEY));
}

export async function clearStoredRefreshToken(): Promise<void> {
  try {
    await runTransaction('readwrite', (store) => store.delete(REFRESH_TOKEN_KEY));
  } catch {
    /*
     * Swallowed, unlike setStoredRefreshToken. This runs during logout, and a
     * user who clicked "sign out" must end up signed out regardless of whether
     * the delete succeeded — the in-memory access token is already gone, and
     * the server session is being revoked independently. Failing here would
     * leave them staring at an error while apparently still logged in.
     */
  }
}

/** Everything, for logout and for session-expired. */
export async function clearSession(): Promise<void> {
  clearAccessToken();
  await clearStoredRefreshToken();
}

/** Test-only: drops the cached connection so a fresh database can be opened. */
export function resetTokenStoreForTests(): void {
  dbPromise = null;
  clearAccessToken();
}

/**
 * Closes this tab's open connection to the auth database, if there is one.
 *
 * Needed by hardReset.ts before it calls `indexedDB.deleteDatabase('notare-auth')`
 * — a delete request waits for every open connection to close before it can
 * actually complete (it only fires 'blocked' in the meantime), and this
 * module's own `dbPromise` cache is exactly such a connection, held open for
 * the tab's entire lifetime by design (`openDatabase`'s own doc comment).
 * Without closing it first, the delete would sit blocked until this tab
 * happens to reload or close on its own — which defeats the entire point of
 * a reset that is supposed to take effect immediately.
 *
 * Safe to call even if nothing has opened the database yet this session —
 * `dbPromise` is simply null in that case, and there is nothing to close.
 */
export async function closeAuthDatabase(): Promise<void> {
  if (dbPromise === null) return;

  const promise = dbPromise;
  dbPromise = null;

  try {
    const database = await promise;
    database.close();
  } catch {
    // Nothing to close if the connection never actually opened.
  }
}

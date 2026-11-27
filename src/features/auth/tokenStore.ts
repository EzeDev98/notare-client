/** Where the access and refresh tokens are kept. */
import { relayAuthTokenToServiceWorker } from '@/pwa/authTokenRelay';

const DB_NAME = 'notare-auth';
const DB_VERSION = 1;
const STORE = 'session';
const REFRESH_TOKEN_KEY = 'refreshToken';

let accessToken: string | null = null;

let accessTokenExpiresAt: number | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string, expiresInMs: number): void {
  accessToken = token;
  accessTokenExpiresAt = Date.now() + expiresInMs;
  relayAuthTokenToServiceWorker(`Bearer ${token}`);
}

export function isAccessTokenExpiring(skewMs = 30_000): boolean {
  if (accessToken === null || accessTokenExpiresAt === null) return true;
  return Date.now() >= accessTokenExpiresAt - skewMs;
}

export function clearAccessToken(): void {
  accessToken = null;
  accessTokenExpiresAt = null;
  relayAuthTokenToServiceWorker(null);
}

let dbPromise: Promise<IDBDatabase> | null = null;

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
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open the auth database.'));
    };

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

        transaction.onabort = () => {
          reject(transaction.error ?? new Error('Auth store transaction aborted.'));
        };
      }),
  );
}

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

export async function setStoredRefreshToken(token: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(token, REFRESH_TOKEN_KEY));
}

export async function clearStoredRefreshToken(): Promise<void> {
  try {
    await runTransaction('readwrite', (store) => store.delete(REFRESH_TOKEN_KEY));
  } catch {}
}

export async function clearSession(): Promise<void> {
  clearAccessToken();
  await clearStoredRefreshToken();
}

export function resetTokenStoreForTests(): void {
  dbPromise = null;
  clearAccessToken();
}

export async function closeAuthDatabase(): Promise<void> {
  if (dbPromise === null) return;

  const promise = dbPromise;
  dbPromise = null;

  try {
    const database = await promise;
    database.close();
  } catch {}
}

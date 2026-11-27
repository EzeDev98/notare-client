/** "Reset this device": a last sync, then removal of everything stored locally. */
import { closeAuthDatabase } from '@/features/auth/tokenStore';
import { db } from '@/features/notes/local/database';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { requestSync } from '@/sync/engine';
import { EVER_STANDALONE_STORAGE_KEY } from '@/pwa/displayMode';

export interface FinalSyncResult {
  hadUnsyncedChanges: boolean;
  unsyncedCount: number;
}

export async function attemptFinalSync(ownerId: number | null): Promise<FinalSyncResult> {
  if (ownerId !== null) {
    try {
      await requestSync('manual-reset');
    } catch {}
  }

  const [dirtyRows, queuedCount] = await Promise.all([
    noteRepository.listDirty(),
    outboxRepository.count(),
  ]);

  return {
    hadUnsyncedChanges: dirtyRows.length > 0 || queuedCount > 0,
    unsyncedCount: Math.max(dirtyRows.length, queuedCount),
  };
}

export async function wipeLocalState(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister().catch(() => false)),
      );
    } catch {}
  }

  if (typeof caches !== 'undefined') {
    try {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
    } catch {}
  }

  await deleteAllDatabases();

  try {
    const everStandaloneFlag = localStorage.getItem(EVER_STANDALONE_STORAGE_KEY);
    localStorage.clear();
    if (everStandaloneFlag !== null) {
      localStorage.setItem(EVER_STANDALONE_STORAGE_KEY, everStandaloneFlag);
    }
  } catch {}

  try {
    sessionStorage.clear();
  } catch {}
}

async function deleteAllDatabases(): Promise<void> {
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
    } catch {}
  }

  const names = new Set([...knownNames, ...enumeratedNames]);

  await Promise.all([...names].map((name) => deleteDatabase(name)));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
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

import { metaRepository } from '@/features/notes/local/noteRepository';
import { isOffline } from '@/lib/http/errors';
import { evictTombstone, reconcileFromSync } from '@/sync/reconcile';
import { syncService } from '@/sync/syncService';
import { markTransportFailure } from '@/sync/transportFailure';

const PAGE_SIZE = 100;

let inFlight: Promise<void> | null = null;

/**
 * Pulls the delta feed and merges it into local storage.
 *
 * REENTRANT-SAFE, same-tab only — identical reasoning to `pushOutbox`: a
 * call arriving while one is already running awaits that run rather than
 * starting a second one racing it over the same cursor.
 *
 * `ownerId` is a PARAMETER, not read from auth context here — this
 * subsystem has no knowledge of React (architecture doc §3.8), and a newly
 * inserted row needs an owner the moment it's written, not whenever some
 * later screen happens to ask. The caller (`useSync`) is where that context
 * actually lives.
 */
export function pullChanges(ownerId: number | null): Promise<void> {
  inFlight ??= run(ownerId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(ownerId: number | null): Promise<void> {
  const since = await metaRepository.getSyncCursor();
  let page = 0;
  let latestCursor: string | undefined;

  /*
   * `since` is sent UNCHANGED on every page of this run (types.ts,
   * architecture doc §2.3): `nextCursor` stays fixed while `hasMore` is
   * true, and advancing per page is the design that infinite-loops on a
   * page that shares one timestamp. Only `page` moves.
   */
  for (;;) {
    let response;
    try {
      response =
        since === undefined
          ? await syncService.pull({ page, size: PAGE_SIZE })
          : await syncService.pull({ since, page, size: PAGE_SIZE });
    } catch (error) {
      // Same reasoning as push.ts: nothing in this run reached local
      // storage that the stored cursor doesn't already account for, so the
      // honest move is to stop and let the next trigger retry from here.
      if (isOffline(error)) {
        markTransportFailure();
        return;
      }
      throw error;
    }

    for (const note of response.changed) {
      await reconcileFromSync(note, ownerId);
    }

    for (const deletedId of response.deletedIds) {
      await evictTombstone(deletedId);
    }

    latestCursor = response.nextCursor;

    if (!response.hasMore) break;
    page += 1;
  }

  /*
   * Written only HERE, after a full drain — never inside the loop. The
   * cursor advancing while `hasMore` is still true is the exact bug the
   * architecture doc names under Risks ("Cursor advanced during hasMore").
   */
  if (latestCursor) {
    await metaRepository.setSyncCursor(latestCursor);
  }
}

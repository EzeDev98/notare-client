/** Pulls changes from the server into the device. */
import { metaRepository } from '@/features/notes/local/noteRepository';
import { isOffline } from '@/lib/http/errors';
import { evictTombstone, reconcileFromSync } from '@/sync/reconcile';
import { syncService } from '@/sync/syncService';
import { markTransportFailure } from '@/sync/transportFailure';

const PAGE_SIZE = 100;

let inFlight: Promise<void> | null = null;

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

  for (;;) {
    let response;
    try {
      response =
        since === undefined
          ? await syncService.pull({ page, size: PAGE_SIZE })
          : await syncService.pull({ since, page, size: PAGE_SIZE });
    } catch (error) {
      if (isOffline(error)) {
        markTransportFailure();
        return;
      }
      throw error;
    }

    for (const entry of response.changed) {
      await reconcileFromSync(entry, ownerId);
    }

    for (const deletedId of response.deletedIds) {
      await evictTombstone(deletedId);
    }

    latestCursor = response.nextCursor;

    if (!response.hasMore) break;
    page += 1;
  }

  if (latestCursor) {
    await metaRepository.setSyncCursor(latestCursor);
  }
}

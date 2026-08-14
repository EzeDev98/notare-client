import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import type { OutboxRow } from '@/features/notes/local/outboxRow';
import { isOffline } from '@/lib/http/errors';
import { syncService } from '@/sync/syncService';
import { markTransportFailure } from '@/sync/transportFailure';
import type { SyncOperationRequest } from '@/sync/types';

/** The server's own limit (architecture doc §2.3). */
const MAX_BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * `OutboxRow` -> the wire shape, dropping nulls to absent fields.
 *
 * `OutboxRow` uses `| null` throughout (Dexie/IndexedDB convention, same as
 * `NoteRow`); `SyncOperationRequest` uses optional fields (the server DTO
 * omits them rather than sending null). This is the one place that
 * translates between the two, same reasoning as `noteMappers.ts`.
 */
function toOperationRequest(row: OutboxRow): SyncOperationRequest {
  const request: SyncOperationRequest = { operationId: row.operationId, type: row.type };
  if (row.clientId !== null) request.clientId = row.clientId;
  if (row.noteId !== null) request.noteId = row.noteId;
  if (row.title !== null) request.title = row.title;
  if (row.content !== null) request.content = row.content;
  if (row.version !== null) request.version = row.version;
  return request;
}

let inFlight: Promise<void> | null = null;

/**
 * Pushes the outbox to the server.
 *
 * REENTRANT-SAFE, same-tab only: a call arriving while one is already
 * running awaits that run rather than starting a second, concurrent one —
 * which matters here specifically because the outbox is a FIFO and two
 * pushes racing each other could split it across two batches with no
 * ordering between them. Cross-tab locking (`acquire lock 'notare.sync'` in
 * the architecture doc) is 8F's job; this is the minimal same-tab version
 * 8C actually needs to be correct.
 *
 * WHEN this runs is deliberately not this function's concern — see
 * `useSync` (8D), which calls it on mount and on the browser's `online`
 * event, no backoff, then chains a pull after it. Retry-with-backoff is
 * explicitly 8F's scope per the roadmap; building it into this function now
 * would be scheduling policy leaking into the engine that is supposed to be
 * schedule-agnostic.
 */
export function pushOutbox(): Promise<void> {
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<void> {
  const outbox = await outboxRepository.list();
  if (outbox.length === 0) return;

  /*
   * Rows whose note already carries 'conflict' or 'invalid' are excluded
   * before anything is sent.
   *
   * Neither status is incorrect to resend — `operationId` keeps a retry
   * idempotent either way — but both are GUARANTEED useless until something
   * external changes: a conflict needs a human decision (8E, not built yet);
   * an invalid operation will be invalid again for the same reason every
   * time. Sending them on every trigger (mount, every `online` event) would
   * mean an offline session with one bad edit spends every future sync run
   * re-discovering the same fact.
   */
  const eligible: OutboxRow[] = [];
  const snapshots = new Map<string, NoteRow>();

  for (const row of outbox) {
    const note = await noteRepository.getByLocalId(row.localId);
    if (note && (note.syncState === 'conflict' || note.syncState === 'invalid')) continue;

    eligible.push(row);
    // Snapshotted NOW, before anything is sent: applyServerAck's staleness
    // guard needs localUpdatedAt as it stood when the request went out, not
    // as it stands once a response comes back — the whole point of that
    // guard is to detect an edit that happened WHILE we were waiting.
    if (note) snapshots.set(row.localId, note);
  }

  if (eligible.length === 0) return;

  // Chunks are sent SEQUENTIALLY, not in parallel. Order must survive across
  // chunk boundaries the same way it must within one batch (a CREATE and its
  // following UPDATE could legally land in different chunks if the outbox
  // is large) — the architecture doc's "the client must never parallelise a
  // batch" applies to the whole push, not just one request.
  for (const batch of chunk(eligible, MAX_BATCH_SIZE)) {
    let response;
    try {
      response = await syncService.pushBatch(batch.map(toOperationRequest));
    } catch (error) {
      /*
       * Transport failure — offline, timeout, or (via ApiError's 'http'
       * kind surfacing a 5xx) the batch endpoint itself failing outright.
       * "A 500 on the batch means retry the whole batch — the ledger makes
       * that safe" (architecture doc). Nothing in THIS chunk or any later
       * one was applied, so the correct move is to stop and leave
       * everything still queued for the next trigger — not to keep going
       * and risk sending chunk 3 while chunk 2 is unaccounted for.
       */
      if (isOffline(error)) {
        markTransportFailure();
        return;
      }
      throw error;
    }

    const byOperationId = new Map(response.results.map((result) => [result.operationId, result]));

    for (const row of batch) {
      const result = byOperationId.get(row.operationId);
      // Contract violation, not a real case — matching by index instead
      // would be the actual bug this guards against (architecture doc:
      // "match results by operationId, never by array index").
      if (!result) continue;

      const expectedLocalUpdatedAt = snapshots.get(row.localId)?.localUpdatedAt ?? 0;

      switch (result.status) {
        case 'APPLIED': {
          if (row.type === 'DELETE') {
            await noteRepository.applyDeleteAck(row.localId, expectedLocalUpdatedAt);
          } else if (result.note) {
            await noteRepository.applyServerAck(
              row.localId,
              {
                version: result.note.version,
                updatedAt: result.note.updatedAt,
                serverId: result.note.id,
              },
              expectedLocalUpdatedAt,
            );
          }
          break;
        }

        case 'CONFLICT': {
          // "Keep the local copy" (architecture doc) — the outbox row is
          // deliberately NOT cleared here; markConflict only stamps the
          // note. It stays queued, excluded from future runs by the guard
          // above, until 8E lets the user resolve it.
          if (result.note) {
            await noteRepository.markConflict(row.localId, result.note);
          }
          break;
        }

        case 'NOT_FOUND': {
          // "Drop the operation and evict the local note (deleted on
          // another device)" — architecture doc, settled explicitly.
          await outboxRepository.clearForNote(row.localId);
          await noteRepository.hardDelete(row.localId);
          break;
        }

        case 'INVALID': {
          // "Do not retry — quarantine, log, surface as a client bug, never
          // silently discard the user's text." Removing the outbox row is
          // the "do not retry"; markInvalid deliberately leaves title and
          // content untouched — see its own doc comment for why.
          await outboxRepository.clearForNote(row.localId);
          await noteRepository.markInvalid(row.localId);
          console.error('[sync] operation rejected as INVALID, not retrying', {
            operationId: row.operationId,
            type: row.type,
            localId: row.localId,
            message: result.message,
          });
          break;
        }

        default: {
          // Exhaustiveness check: a fifth status the server starts sending
          // fails this compile, not a silent no-op at runtime.
          const exhaustive: never = result.status;
          console.error('[sync] unrecognised sync result status', exhaustive);
        }
      }
    }
  }
}

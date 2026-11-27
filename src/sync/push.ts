/** Sends queued note changes to the server. */
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import type { OutboxRow } from '@/features/notes/local/outboxRow';
import { isOffline } from '@/lib/http/errors';
import { syncService } from '@/sync/syncService';
import { markTransportFailure } from '@/sync/transportFailure';
import type { SyncOperationRequest } from '@/sync/types';

const MAX_BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toOperationRequest(row: OutboxRow): SyncOperationRequest {
  const request: SyncOperationRequest = { operationId: row.operationId, type: row.type };
  if (row.clientId !== null) request.clientId = row.clientId;
  if (row.noteId !== null) request.noteId = row.noteId;
  if (row.content !== null) request.content = row.content;
  return request;
}

let inFlight: Promise<void> | null = null;

export function pushOutbox(): Promise<void> {
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<void> {
  const outbox = await outboxRepository.list();
  if (outbox.length === 0) return;

  const eligible: OutboxRow[] = [];
  const snapshots = new Map<string, NoteRow>();

  for (const row of outbox) {
    const note = await noteRepository.getByLocalId(row.localId);
    if (note && note.syncState === 'invalid') continue;

    eligible.push(row);
    if (note) snapshots.set(row.localId, note);
  }

  if (eligible.length === 0) return;

  for (const batch of chunk(eligible, MAX_BATCH_SIZE)) {
    let response;
    try {
      response = await syncService.pushBatch(batch.map(toOperationRequest));
    } catch (error) {
      if (isOffline(error)) {
        markTransportFailure();
        return;
      }
      throw error;
    }

    const byOperationId = new Map(response.results.map((result) => [result.operationId, result]));

    for (const row of batch) {
      const result = byOperationId.get(row.operationId);
      if (!result) continue;

      const expectedLocalUpdatedAt = snapshots.get(row.localId)?.localUpdatedAt ?? 0;

      switch (result.status) {
        case 'APPLIED': {
          if (row.type === 'DELETE') {
            await outboxRepository.clearForNote(row.localId);
            await noteRepository.hardDelete(row.localId);
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

        case 'NOT_FOUND': {
          await outboxRepository.clearForNote(row.localId);
          await noteRepository.hardDelete(row.localId);
          break;
        }

        case 'INVALID': {
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
          const exhaustive: never = result.status;
          console.error('[sync] unrecognised sync result status', exhaustive);
        }
      }
    }
  }
}

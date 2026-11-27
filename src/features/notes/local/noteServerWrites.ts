/** Writes to the notes table that come from the server. */
import { db } from '@/features/notes/local/database';
import {
  flag,
  fromNoteResponse,
  fromNoteSummary,
  isSameRow,
  syncStateFor,
} from '@/features/notes/local/noteMappers';
import type { NoteResponse, NoteSummaryResponse } from '@/features/notes/types';
import type { ServerDateTime } from '@/lib/http/types';
import { notifyLocalMutation } from '@/sync/mutationSignal';

export const noteServerWrites = {
  async applyServerAck(
    localId: string,
    ack: { version: number | null; updatedAt: ServerDateTime | null; serverId?: number },
    expectedLocalUpdatedAt: number,
  ): Promise<void> {
    const requeued = await db.transaction('rw', db.notes, db.outbox, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return false;

      const unchanged = existing.localUpdatedAt === expectedLocalUpdatedAt;
      const serverId = ack.serverId ?? existing.serverId;
      const clean = unchanged && serverId !== null;

      await db.notes.put({
        ...existing,
        serverId,
        version: ack.version,
        updatedAt: ack.updatedAt,
        dirty: clean ? 0 : 1,
        syncState: syncStateFor(serverId, clean),
        restorable: false,
      });

      await db.outbox.where('localId').equals(localId).delete();

      if (clean || serverId === null || existing.deleted === 1) return false;

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        localId,
        clientId: null,
        noteId: serverId,
        content: existing.content,
        version: null,
        queuedAt: Date.now(),
      });
      return true;
    });

    if (requeued) notifyLocalMutation();
  },

  markInvalid(localId: string): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({ ...existing, syncState: 'invalid' });
    });
  },

  upsertFromServer(note: NoteResponse): Promise<'inserted' | 'updated' | 'skipped'> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.where('serverId').equals(note.id).first();

      if (!existing) {
        await db.notes.put(fromNoteResponse(note));
        return 'inserted';
      }

      if (existing.dirty === 1) return 'skipped';

      const noChange =
        existing.content === (note.content ?? '') &&
        existing.pinned === flag(note.pinned) &&
        existing.version === note.version &&
        existing.createdAt === note.createdAt &&
        existing.updatedAt === note.updatedAt &&
        existing.ownerId === note.ownerId &&
        existing.lastModifiedBy === note.lastModifiedBy;
      if (noChange) return 'skipped';

      await db.notes.put(fromNoteResponse(note, existing));
      return 'updated';
    });
  },

  upsertSummaries(summaries: NoteSummaryResponse[], ownerId: number | null): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      for (const summary of summaries) {
        const existing = await db.notes.where('serverId').equals(summary.id).first();

        if (existing?.dirty === 1) continue;

        const next = fromNoteSummary(summary, ownerId, existing);
        if (existing && isSameRow(existing, next)) continue;

        await db.notes.put(next);
      }
    });
  },
};

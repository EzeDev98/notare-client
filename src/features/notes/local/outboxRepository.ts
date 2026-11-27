/** The queue of note changes waiting to be sent. */
import { db } from '@/features/notes/local/database';
import type { OutboxRow } from '@/features/notes/local/outboxRow';
import { notifyLocalMutation } from '@/sync/mutationSignal';

export const outboxRepository = {
  list(): Promise<OutboxRow[]> {
    return db.outbox.orderBy('id').toArray();
  },

  listForNote(localId: string): Promise<OutboxRow[]> {
    return db.outbox.where('localId').equals(localId).sortBy('id');
  },

  count(): Promise<number> {
    return db.outbox.count();
  },

  async enqueueCreate(note: { localId: string; clientId: string; content: string }): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();

      if (existing?.type === 'CREATE') {
        await db.outbox.update(existing.id, { content: note.content });
        return;
      }

      if (existing) {
        await db.outbox.delete(existing.id);
      }

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'CREATE',
        localId: note.localId,
        clientId: note.clientId,
        noteId: null,
        content: note.content,
        version: null,
        queuedAt: Date.now(),
      });
    });

    notifyLocalMutation();
  },

  async enqueueUpdate(note: { localId: string; noteId: number; content: string }): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();

      if (existing?.type === 'UPDATE') {
        await db.outbox.update(existing.id, {
          content: note.content,
          version: null,
          noteId: note.noteId,
        });
        return;
      }

      if (existing) {
        await db.outbox.delete(existing.id);
      }

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        localId: note.localId,
        clientId: null,
        noteId: note.noteId,
        content: note.content,
        version: null,
        queuedAt: Date.now(),
      });
    });

    notifyLocalMutation();
  },

  async enqueueDelete(note: { localId: string; noteId: number }): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();
      if (existing) {
        await db.outbox.delete(existing.id);
      }

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'DELETE',
        localId: note.localId,
        clientId: null,
        noteId: note.noteId,
        content: null,
        version: null,
        queuedAt: Date.now(),
      });
    });

    notifyLocalMutation();
  },

  async discardPendingCreate(localId: string): Promise<void> {
    const existing = await db.outbox.where('localId').equals(localId).first();
    if (existing?.type === 'CREATE') {
      await db.outbox.delete(existing.id);
    }
  },

  async clearForNote(localId: string): Promise<void> {
    await db.outbox.where('localId').equals(localId).delete();
  },

  async syncQueuedContent(localId: string, content: string): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(localId).first();
      if (!existing) return;
      await db.outbox.update(existing.id, { content });
    });
  },
};

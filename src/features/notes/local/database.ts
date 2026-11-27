/** The local notes database. */
import Dexie, { type EntityTable } from 'dexie';

import type { ClipRow } from '@/features/notes/local/clipRow';
import type { MetaRow } from '@/features/notes/local/metaRow';
import type { NotificationRow } from '@/features/notes/local/notificationRow';
import type { NoteRow } from '@/features/notes/local/noteRow';
import type { OutboxRow } from '@/features/notes/local/outboxRow';
import type { TranscriptRow } from '@/features/notes/local/transcriptRow';
import { planIdentityMerge } from '@/features/notes/local/unifyIdentity';

export class NotareDatabase extends Dexie {
  notes!: EntityTable<NoteRow, 'localId'>;
  meta!: EntityTable<MetaRow, 'key'>;
  outbox!: EntityTable<OutboxRow, 'id'>;
  clips!: EntityTable<ClipRow, 'id'>;
  transcripts!: EntityTable<TranscriptRow, 'clipId'>;
  notifications!: EntityTable<NotificationRow, 'id'>;

  constructor(name = 'notare') {
    super(name);

    this.version(1).stores({
      notes:
        'localId, &serverId, clientId, [ownerId+deleted+archived], dirty, syncState, localUpdatedAt, updatedAt',

      meta: 'key',
    });

    this.version(2)
      .stores({
        outbox: '++id, &operationId, localId',
      })
      .upgrade(async (tx) => {
        const notes = await tx.table<NoteRow, string>('notes').where('dirty').equals(1).toArray();

        notes.sort((a, b) => {
          const byLocalUpdatedAt = a.localUpdatedAt - b.localUpdatedAt;
          if (byLocalUpdatedAt !== 0) return byLocalUpdatedAt;

          const aType = a.serverId === null ? 'CREATE' : a.deleted === 1 ? 'DELETE' : null;
          const bType = b.serverId === null ? 'CREATE' : b.deleted === 1 ? 'DELETE' : null;

          if (aType === bType) return 0;
          if (aType === 'CREATE') return -1;
          if (bType === 'CREATE') return 1;
          if (aType === 'DELETE') return -1;
          if (bType === 'DELETE') return 1;
          return 0;
        });

        const now = Date.now();

        const seeded: OutboxRow[] = [];

        for (const note of notes) {
          if (note.serverId === null) {
            seeded.push({
              operationId: crypto.randomUUID(),
              type: 'CREATE',
              localId: note.localId,
              clientId: note.clientId,
              noteId: null,
              content: note.content,
              version: null,
              queuedAt: now,
            });
            continue;
          }

          if (note.deleted === 1) {
            seeded.push({
              operationId: crypto.randomUUID(),
              type: 'DELETE',
              localId: note.localId,
              clientId: null,
              noteId: note.serverId,
              content: null,
              version: null,
              queuedAt: now,
            });
          }
        }

        if (seeded.length > 0) {
          await tx.table<OutboxRow, number>('outbox').bulkAdd(seeded);
        }
      });

    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('notes')
          .toCollection()
          .modify((note: Record<string, unknown>) => {
            delete note.title;
          });

        await tx
          .table('outbox')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            delete row.title;
          });
      });

    this.version(4)
      .stores({
        clips: 'id, noteId, uploadState, [noteId+createdAt]',
        transcripts: 'clipId, status',
        shared: 'noteId, role, updatedAt',
        people: 'id, state',
        notifications: 'id, readAt',
      })
      .upgrade(async (tx) => {
        const notes = tx.table<NoteRow, string>('notes');

        const plan = planIdentityMerge(await notes.toArray());
        if (plan.size === 0) return;

        const moved: NoteRow[] = [];
        for (const [from, to] of plan) {
          const row = await notes.get(from);
          if (row) moved.push({ ...row, localId: to });
        }

        await notes.bulkDelete([...plan.keys()]);
        await notes.bulkAdd(moved);

        await tx
          .table<OutboxRow, number>('outbox')
          .toCollection()
          .modify((row) => {
            const next = plan.get(row.localId);
            if (next !== undefined) row.localId = next;
          });
      });

    this.version(5).stores({ pendingUpdates: '++id, noteId' });

    this.version(6)
      .stores({ shared: null, people: null, pendingUpdates: null })
      .upgrade(async (tx) => {
        await tx
          .table('notes')
          .toCollection()
          .modify((note: Record<string, unknown>) => {
            delete note.role;
            delete note.ownerName;
          });
      });

    this.version(7)
      .stores({
        notes: 'localId, &serverId, clientId, [ownerId+deleted], dirty, syncState, localUpdatedAt, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('notes')
          .toCollection()
          .modify((note: Record<string, unknown>) => {
            delete note.archived;
          });
      });
  }
}

export const db = new NotareDatabase();

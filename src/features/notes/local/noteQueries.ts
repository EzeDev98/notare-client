/** Reads from the notes table. */
import { db } from '@/features/notes/local/database';
import type { NoteRow } from '@/features/notes/local/noteRow';

function byPinnedThenRecent(a: NoteRow, b: NoteRow): number {
  if (a.pinned !== b.pinned) return b.pinned - a.pinned;
  return b.localUpdatedAt - a.localUpdatedAt;
}

function byRecent(a: NoteRow, b: NoteRow): number {
  return b.localUpdatedAt - a.localUpdatedAt;
}

export interface NoteCounts {
  all: number;
  waiting: number;
}

export const noteQueries = {
  async listActive(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes.where('[ownerId+deleted]').equals([ownerId, 0]).toArray();
    return rows.sort(byPinnedThenRecent);
  },

  async search(term: string, ownerId: number): Promise<NoteRow[]> {
    const needle = term.trim().toLowerCase();
    if (needle === '') return [];

    const rows = await db.notes
      .where('[ownerId+deleted]')
      .equals([ownerId, 0])
      .filter(
        (row) =>
          row.content.toLowerCase().includes(needle) ||
          (row.aiTitle ?? '').toLowerCase().includes(needle),
      )
      .toArray();

    return rows.sort(byRecent);
  },

  async counts(ownerId: number): Promise<NoteCounts> {
    const [all, waiting] = await Promise.all([
      db.notes.where('[ownerId+deleted]').equals([ownerId, 0]).count(),
      db.notes.where('dirty').equals(1).count(),
    ]);
    return { all, waiting };
  },

  getByLocalId(localId: string): Promise<NoteRow | undefined> {
    return db.notes.get(localId);
  },

  getByServerId(serverId: number): Promise<NoteRow | undefined> {
    return db.notes.where('serverId').equals(serverId).first();
  },

  getByClientId(clientId: string): Promise<NoteRow | undefined> {
    return db.notes.where('clientId').equals(clientId).first();
  },

  listDirty(): Promise<NoteRow[]> {
    return db.notes.where('dirty').equals(1).toArray();
  },
};

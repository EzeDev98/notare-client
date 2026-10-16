import { db } from '@/features/notes/local/database';
import { metaRepository } from '@/features/notes/local/metaRepository';
import type { PendingUpdateRow } from '@/features/notes/local/pendingUpdateRow';

const seqKey = (noteId: number): string => `collab.lastSeq.${String(noteId)}`;

/** What this device remembers about a live note: how far it has read, and what it has not yet sent. */
export const collabStore = {
  /** The last seq this device holds for the note, 0 for none. */
  async lastSeq(noteId: number): Promise<number> {
    return (await metaRepository.get<number>(seqKey(noteId))) ?? 0;
  },

  setLastSeq(noteId: number, seq: number): Promise<void> {
    return metaRepository.set(seqKey(noteId), seq);
  },

  /** Store an update before it is sent. Returns its id. */
  async addPending(noteId: number, bytes: Uint8Array): Promise<number> {
    return (await db.pendingUpdates.add({ noteId, bytes })) as number;
  },

  /** Every unacknowledged update of the note, oldest first. */
  pending(noteId: number): Promise<PendingUpdateRow[]> {
    return db.pendingUpdates.where('noteId').equals(noteId).sortBy('id');
  },

  removePending(id: number): Promise<void> {
    return db.pendingUpdates.delete(id);
  },
};

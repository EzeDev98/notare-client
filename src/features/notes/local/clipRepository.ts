import type { ClipRow } from '@/features/notes/local/clipRow';
import { db } from '@/features/notes/local/database';
import { notifyLocalMutation } from '@/sync/mutationSignal';

/**
 * Voice clips on the device (master M-2, step 8j). A clip belongs to one note,
 * and is removed with it, along with its transcript.
 *
 * A recording is written here FIRST, as 'local', and uploaded later by the
 * sync engine (sync/clipUpload.ts). It works on a note that has no server id.
 */
export const clipRepository = {
  get(id: string): Promise<ClipRow | undefined> {
    return db.clips.get(id);
  },

  /** A note's clips, oldest first. */
  listForNote(noteId: string): Promise<ClipRow[]> {
    return db.clips.where('noteId').equals(noteId).sortBy('createdAt');
  },

  /** How many clips a note has. A note with a clip is never empty (8e). */
  countForNote(noteId: string): Promise<number> {
    return db.clips.where('noteId').equals(noteId).count();
  },

  /** Clip counts for every note at once. Reads keys only, never the audio. */
  async countsByNote(): Promise<Record<string, number>> {
    const keys = await db.clips.orderBy('noteId').keys();
    const counts: Record<string, number> = {};
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  },

  /**
   * Stores a new recording on the device, immediately, as 'local'.
   * `noteId` is the note's localId; the note need not be on the server yet.
   */
  async add(noteId: string, audio: Blob, durationMs: number, mimeType: string): Promise<ClipRow> {
    const row: ClipRow = {
      id: crypto.randomUUID(),
      noteId,
      uploadState: 'local',
      createdAt: Date.now(),
      durationSeconds: durationMs / 1000,
      mimeType,
      audio,
      serverId: null,
    };
    await db.clips.put(row);
    // Outside any transaction, so the engine can start an upload soon.
    notifyLocalMutation();
    return row;
  },

  put(row: ClipRow): Promise<string> {
    return db.clips.put(row);
  },

  async setUploadState(id: string, uploadState: ClipRow['uploadState']): Promise<void> {
    await db.clips.update(id, { uploadState });
  },

  /** The server has the clip. The device copy of the audio is released. */
  async markUploaded(id: string, serverId: number): Promise<void> {
    await db.clips.update(id, { uploadState: 'synced', serverId, audio: null });
  },

  /** "Try again" on a failed upload. */
  async retry(id: string): Promise<void> {
    await db.clips.update(id, { uploadState: 'local' });
    notifyLocalMutation();
  },

  /** Clips waiting to be sent. */
  listToUpload(): Promise<ClipRow[]> {
    return db.clips.where('uploadState').equals('local').toArray();
  },

  /** Puts clips a killed upload left as 'uploading' back in the queue. */
  async resetStuckUploads(): Promise<void> {
    await db.clips.where('uploadState').equals('uploading').modify({ uploadState: 'local' });
  },

  /**
   * Copies a note's clips (and their transcripts) onto another note, for
   * Make a copy. Only clips whose audio is still on the device can be copied;
   * returns the new clip ids.
   */
  copyForNote(fromNoteId: string, toNoteId: string): Promise<string[]> {
    return db.transaction('rw', db.clips, db.transcripts, async () => {
      const source = await db.clips.where('noteId').equals(fromNoteId).sortBy('createdAt');
      const copied: string[] = [];

      for (const clip of source) {
        if (clip.audio === null) continue;

        const id = crypto.randomUUID();
        await db.clips.put({
          ...clip,
          id,
          noteId: toNoteId,
          uploadState: 'local',
          serverId: null,
        });

        const transcript = await db.transcripts.get(clip.id);
        if (transcript) await db.transcripts.put({ ...transcript, clipId: id });
        copied.push(id);
      }

      return copied;
    });
  },

  /** Removes one clip and its transcript. */
  remove(id: string): Promise<void> {
    return db.transaction('rw', db.clips, db.transcripts, async () => {
      await db.transcripts.delete(id);
      await db.clips.delete(id);
    });
  },

  /** Removes every clip of a note, and their transcripts. */
  removeForNote(noteId: string): Promise<void> {
    return db.transaction('rw', db.clips, db.transcripts, async () => {
      const ids = await db.clips.where('noteId').equals(noteId).primaryKeys();
      await db.transcripts.bulkDelete(ids);
      await db.clips.bulkDelete(ids);
    });
  },
};

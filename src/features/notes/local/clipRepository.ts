/** Voice clips stored on the device. */
import type { ClipRow } from '@/features/notes/local/clipRow';
import { db } from '@/features/notes/local/database';
import { notifyLocalMutation } from '@/sync/mutationSignal';

export const clipRepository = {
  get(id: string): Promise<ClipRow | undefined> {
    return db.clips.get(id);
  },

  listForNote(noteId: string): Promise<ClipRow[]> {
    return db.clips.where('noteId').equals(noteId).sortBy('createdAt');
  },

  countForNote(noteId: string): Promise<number> {
    return db.clips.where('noteId').equals(noteId).count();
  },

  findByServerId(serverId: number): Promise<ClipRow | undefined> {
    return db.clips.filter((clip) => clip.serverId === serverId).first();
  },

  async countsByNote(): Promise<Record<string, number>> {
    const keys = await db.clips.orderBy('noteId').keys();
    const counts: Record<string, number> = {};
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  },

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
    notifyLocalMutation();
    return row;
  },

  put(row: ClipRow): Promise<string> {
    return db.clips.put(row);
  },

  async setUploadState(id: string, uploadState: ClipRow['uploadState']): Promise<void> {
    await db.clips.update(id, { uploadState });
  },

  async markUploaded(id: string, serverId: number): Promise<void> {
    await db.clips.update(id, { uploadState: 'synced', serverId, audio: null });
  },

  async audioBytes(): Promise<number> {
    let total = 0;
    await db.clips.each((clip) => {
      total += clip.audio?.size ?? 0;
    });
    return total;
  },

  releaseSyncedAudio(): Promise<number> {
    return db.transaction('rw', db.clips, async () => {
      let freed = 0;
      const rows = await db.clips.where('uploadState').equals('synced').toArray();
      for (const clip of rows) {
        if (clip.audio === null) continue;
        freed += clip.audio.size;
        await db.clips.update(clip.id, { audio: null });
      }
      return freed;
    });
  },

  async retry(id: string): Promise<void> {
    await db.clips.update(id, { uploadState: 'local' });
    notifyLocalMutation();
  },

  listToUpload(): Promise<ClipRow[]> {
    return db.clips.where('uploadState').equals('local').toArray();
  },

  async resetStuckUploads(): Promise<void> {
    await db.clips.where('uploadState').equals('uploading').modify({ uploadState: 'local' });
  },

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

  remove(id: string): Promise<void> {
    return db.transaction('rw', db.clips, db.transcripts, async () => {
      await db.transcripts.delete(id);
      await db.clips.delete(id);
    });
  },

  removeForNote(noteId: string): Promise<void> {
    return db.transaction('rw', db.clips, db.transcripts, async () => {
      const ids = await db.clips.where('noteId').equals(noteId).primaryKeys();
      await db.transcripts.bulkDelete(ids);
      await db.clips.bulkDelete(ids);
    });
  },
};

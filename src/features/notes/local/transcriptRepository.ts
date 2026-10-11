import { db } from '@/features/notes/local/database';
import type { TranscriptRow } from '@/features/notes/local/transcriptRow';

/** The transcript of a clip. One row per clip (master M-12). */
export const transcriptRepository = {
  get(clipId: string): Promise<TranscriptRow | undefined> {
    return db.transcripts.get(clipId);
  },

  /**
   * The text of every finished transcript, joined per note, for searching.
   * Reads clip keys only, never the audio.
   */
  async textsByNote(): Promise<Map<string, string>> {
    const clips = db.clips.orderBy('noteId');
    const [noteIds, clipIds] = await Promise.all([clips.keys(), clips.primaryKeys()]);
    const rows = await db.transcripts.bulkGet(clipIds);
    const texts = new Map<string, string>();
    rows.forEach((row, index) => {
      const noteId = noteIds[index];
      if (typeof noteId !== 'string' || row?.status !== 'done' || !row.text) return;
      texts.set(noteId, `${texts.get(noteId) ?? ''}\n${row.text}`);
    });
    return texts;
  },

  put(row: TranscriptRow): Promise<string> {
    return db.transcripts.put(row);
  },

  remove(clipId: string): Promise<void> {
    return db.transcripts.delete(clipId);
  },
};

import { db } from '@/features/notes/local/database';
import type { TranscriptRow } from '@/features/notes/local/transcriptRow';

/** The transcript of a clip. One row per clip (master M-12). */
export const transcriptRepository = {
  get(clipId: string): Promise<TranscriptRow | undefined> {
    return db.transcripts.get(clipId);
  },

  put(row: TranscriptRow): Promise<string> {
    return db.transcripts.put(row);
  },

  remove(clipId: string): Promise<void> {
    return db.transcripts.delete(clipId);
  },
};

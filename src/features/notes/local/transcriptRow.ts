/**
 * The transcript of one clip (master M-12). One row per clip, kept with it and
 * created, synced, deleted and restored with it. The text is not part of the
 * note body until the person inserts it.
 */
export interface TranscriptRow {
  /** PRIMARY KEY. The clip this transcript belongs to. */
  clipId: string;

  status: 'none' | 'queued' | 'transcribing' | 'done' | 'failed';

  /** Set when `status` is 'done'. */
  text: string | null;

  /** Epoch milliseconds, ours. */
  updatedAt: number;
}

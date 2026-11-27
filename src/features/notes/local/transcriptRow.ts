/** A clip's transcript as stored on the device. */
export interface TranscriptRow {
  clipId: string;

  status: 'none' | 'queued' | 'transcribing' | 'done' | 'failed';

  text: string | null;

  updatedAt: number;
}

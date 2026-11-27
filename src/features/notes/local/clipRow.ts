/** A voice clip as stored on the device. */
export interface ClipRow {
  id: string;

  noteId: string;

  uploadState: 'local' | 'uploading' | 'synced' | 'failed';

  createdAt: number;

  durationSeconds: number | null;

  mimeType: string;

  audio: Blob | null;

  serverId: number | null;
}

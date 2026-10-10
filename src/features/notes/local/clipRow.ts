/**
 * A voice clip, stored on the device (master M-2).
 *
 * A clip belongs to exactly one note and is created, synced, deleted and
 * restored with it. It is written here first and uploaded later, as notes are
 * (step 8j, master O-17).
 */
export interface ClipRow {
  /** PRIMARY KEY. A UUID made on the device. */
  id: string;

  /** The owning note's `localId`. Equal to its `clientId` from version 4 on. */
  noteId: string;

  /**
   * Where the audio is:
   *   local      on the device only, not yet sent
   *   uploading  being sent now
   *   synced     the server has it
   *   failed     the last upload failed; the clip is safe here
   */
  uploadState: 'local' | 'uploading' | 'synced' | 'failed';

  /** Epoch milliseconds, ours. With `noteId` it orders a note's clips. */
  createdAt: number;

  durationSeconds: number | null;

  /** The recording's type, e.g. audio/mp4 or audio/webm. */
  mimeType: string;

  /** The recording. Null once only the server holds it. */
  audio: Blob | null;

  /** The server's id once it has accepted the upload. */
  serverId: number | null;
}

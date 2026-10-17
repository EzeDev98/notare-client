import { api } from '@/core/api';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { isOffline } from '@/lib/http/errors';
import { markTransportFailure } from '@/sync/transportFailure';

let running: Promise<void> | null = null;

/**
 * The clip upload queue (step 8j): the same idea as the note outbox.
 *
 * A clip is 'local' until the server has it. Until step 17 the server's clip
 * endpoint needs a note id, so a clip waits until its note has a serverId. It
 * stays safe on the device the whole time. A note in the bin does not upload.
 *
 * An offline failure puts the clip back in the queue. Any other failure marks
 * it 'failed'; it is not retried on its own, only by "Try again".
 *
 * Called by the sync engine between push and pull, inside its cross-tab lock.
 */
export function uploadPendingClips(): Promise<void> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<void> {
  // Anything left 'uploading' by a tab that was killed is not uploading now.
  await clipRepository.resetStuckUploads();

  for (const clip of await clipRepository.listToUpload()) {
    const note = await noteQueries.getByLocalId(clip.noteId);
    if (!note || note.serverId === null || note.deleted === 1 || clip.audio === null) continue;

    await clipRepository.setUploadState(clip.id, 'uploading');
    try {
      const created = await api.uploadClip(clip.audio, {
        noteId: note.serverId,
        ...(clip.durationSeconds !== null ? { durationSeconds: clip.durationSeconds } : {}),
      });
      await clipRepository.markUploaded(clip.id, created.id);
    } catch (error) {
      if (isOffline(error)) {
        await clipRepository.setUploadState(clip.id, 'local');
        markTransportFailure();
        return;
      }
      await clipRepository.setUploadState(clip.id, 'failed');
    }
  }
}

/** Uploads voice clips waiting on the device. */
import { api } from '@/core/api';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { isOffline } from '@/lib/http/errors';
import { markTransportFailure } from '@/sync/transportFailure';

let running: Promise<void> | null = null;

export function uploadPendingClips(): Promise<void> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<void> {
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

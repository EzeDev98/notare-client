/** Saves a finished recording on the device. */
import { getDraft, persistDraftIfContent } from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { setStorageFull } from '@/features/notes/status/storageFull';

export async function saveClip(
  noteId: string,
  blob: Blob,
  durationSeconds: number,
  mimeType: string,
): Promise<string> {
  const clip = await clipRepository.add(noteId, blob, Math.round(durationSeconds * 1000), mimeType);

  const draft = getDraft(noteId);
  if (draft) {
    draft.clips.push(clip.id);
    await persistDraftIfContent(draft);
  }

  setStorageFull(false);
  return clip.id;
}

import { getDraft, persistDraftIfContent } from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { setStorageFull } from '@/features/notes/status/storageFull';

/**
 * Puts a finished recording on this device and returns its clip id. The sync
 * engine uploads it later. A clip in a blank draft makes it a real note (8e).
 * Throws when the device is out of room; the caller decides what to show.
 */
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

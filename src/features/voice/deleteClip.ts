import { api } from '@/core/api';
import { clipRepository } from '@/features/notes/local/clipRepository';

/**
 * Deletes one voice clip, not its note: its audio and transcript on this device,
 * then its copy on the server. Offline, the server copy stays; nothing shows it,
 * because the clip is no longer in the note's body.
 */
export async function deleteClip(clipId: string): Promise<void> {
  const clip = await clipRepository.get(clipId);
  await clipRepository.remove(clipId);
  if (!clip || clip.serverId === null) return;
  try {
    await api.deleteClip(clip.serverId);
  } catch {
    // Offline or already gone on the server: nothing for the user to do.
  }
}

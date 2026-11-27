/** Deletes one voice clip from the device and the server. */
import { api } from '@/core/api';
import { clipRepository } from '@/features/notes/local/clipRepository';

export async function deleteClip(clipId: string): Promise<void> {
  const clip = await clipRepository.get(clipId);
  await clipRepository.remove(clipId);
  if (!clip || clip.serverId === null) return;
  try {
    await api.deleteClip(clip.serverId);
  } catch {}
}

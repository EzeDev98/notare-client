import { ROUTES } from '@/app/routes';
import { findBlankDraft, startDraft } from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteRepository } from '@/features/notes/local/noteRepository';

/**
 * Where "New note" goes. One blank note at a time: an open blank draft is
 * reused, then a blank note already on the device, and only then a new draft.
 * A draft is memory only: nothing is stored until it has content (8d).
 */
export async function newNotePath(ownerId: number): Promise<string> {
  const draft = findBlankDraft();
  if (draft) return ROUTES.legacy.noteLocal(draft.id);

  const rows = await noteRepository.listActive(ownerId);
  for (const row of rows) {
    const clipCount = await clipRepository.countForNote(row.localId);
    if (isEmptyNote({ content: row.content, clipCount })) return ROUTES.legacy.noteOf(row);
  }

  return ROUTES.legacy.noteLocal(startDraft(ownerId).id);
}

import { StatusSlot } from '@/design-system/ui';
import { useNoteStatus } from '@/features/notes/hooks/useNoteStatus';
import type { NoteRole } from '@/features/notes/local/noteRow';
import { NOTE_STATUS_WORDS } from '@/features/notes/status/noteStatusContent';

/**
 * The note's one status word (step 8h). All the deciding is in useNoteStatus;
 * this only shows it. StatusSlot reserves the width, so nothing around it moves
 * when the word changes.
 */
export function SaveIndicator({ noteId, role }: { noteId: string; role?: NoteRole | undefined }) {
  const status = useNoteStatus(noteId, role);
  return <StatusSlot status={status === null ? '' : NOTE_STATUS_WORDS[status]} />;
}

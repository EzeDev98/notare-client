import { StatusSlot } from '@/design-system/ui';
import type { CollabState } from '@/features/collab/CollabProvider';
import { useNoteStatus } from '@/features/notes/hooks/useNoteStatus';
import type { NoteRole } from '@/features/notes/local/noteRow';
import { NOTE_STATUS_WORDS } from '@/features/notes/status/noteStatusContent';

/**
 * The note's one status word (step 8h). All the deciding is in useNoteStatus;
 * this only shows it. StatusSlot reserves the width, so nothing around it moves
 * when the word changes.
 */
interface SaveIndicatorProps {
  noteId: string;
  role?: NoteRole | undefined;
  /** The live channel's state for this note, when it has one (step 16c). */
  collab?: CollabState | undefined;
}

export function SaveIndicator({ noteId, role, collab }: SaveIndicatorProps) {
  const status = useNoteStatus(noteId, role, collab);
  return <StatusSlot status={status === null ? '' : NOTE_STATUS_WORDS[status]} />;
}

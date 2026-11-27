/** Shows the note's status word. */
import { StatusSlot } from '@/design-system/ui';
import { useNoteStatus } from '@/features/notes/hooks/useNoteStatus';
import { NOTE_STATUS_WORDS } from '@/features/notes/status/noteStatusContent';

interface SaveIndicatorProps {
  noteId: string;
}

export function SaveIndicator({ noteId }: SaveIndicatorProps) {
  const status = useNoteStatus(noteId);
  return <StatusSlot status={status === null ? '' : NOTE_STATUS_WORDS[status]} />;
}

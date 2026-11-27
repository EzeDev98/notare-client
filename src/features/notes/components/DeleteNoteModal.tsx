import { ConfirmModal } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

interface DeleteNoteModalProps {
  open: boolean;
  onClose: () => void;
  /** Deletes the note. False when it could not be deleted; the modal stays open and says so. */
  onDelete: () => Promise<boolean>;
}

/** Asks before a note is deleted for good. The list and the editor both use it. */
export function DeleteNoteModal({ open, onClose, onDelete }: DeleteNoteModalProps) {
  const copy = LIST_COPY.deleteNote;
  return (
    <ConfirmModal
      open={open}
      title={copy.title}
      body={copy.body}
      confirmLabel={copy.confirm}
      danger
      onClose={onClose}
      onConfirm={async () => ((await onDelete()) ? undefined : copy.failed)}
    />
  );
}

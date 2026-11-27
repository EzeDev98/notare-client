/** Asks before deleting a note. */
import { ConfirmModal } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

interface DeleteNoteModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => Promise<boolean>;
}

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

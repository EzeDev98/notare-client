import { Button, Overlay } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

interface LeaveNoteModalProps {
  title: string;
  /** The owner's name, when known. */
  ownerName: string | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** "Leave this note?" The one confirmation in the list, because leaving cannot be undone from here. */
export function LeaveNoteModal({ title, ownerName, open, onCancel, onConfirm }: LeaveNoteModalProps) {
  return (
    <Overlay
      open={open}
      onClose={onCancel}
      title={LIST_COPY.leave.title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {LIST_COPY.leave.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {LIST_COPY.leave.confirm}
          </Button>
        </>
      }
    >
      <p>{LIST_COPY.leave.body(title || LIST_COPY.untitled, ownerName)}</p>
    </Overlay>
  );
}

import { useNavigate } from 'react-router';
import type { Doc } from 'yjs';

import { useAuth } from '@/app/providers/auth-context';
import { ROUTES } from '@/app/routes';
import { useToast } from '@/design-system/ui';
import { EDITOR_COPY } from '@/features/editor/editorContent';
import { bodyToPlainText } from '@/features/editor/noteBody';
import {
  copyNote,
  moveToTrash,
  restoreNote,
  setArchived,
  setPinned,
} from '@/features/notes/actions/noteActions';
import { LIST_COPY } from '@/features/notes/list/listContent';
import type { NoteRow } from '@/features/notes/local/noteRow';

export interface EditorMoreActions {
  pinned: boolean;
  archived: boolean;
  onPin: () => void;
  onCopyText: () => void;
  onMakeCopy: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/**
 * What the editor's more menu does (master 6.3 and 6.4, step 12e). The words and
 * the actions are the list's own. Archive and Delete take you back to the list
 * with an Undo toast; Undo puts the note back and opens it again.
 */
export function useEditorActions(row: NoteRow, doc: Doc): EditorMoreActions {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { state } = useAuth();
  const userId =
    state.status === 'authenticated' || state.status === 'refreshing' ? state.user.id : null;

  const { localId } = row;
  const pinned = row.pinned === 1;
  const archived = row.archived === 1;

  const reopen = (): void => {
    void navigate(ROUTES.legacy.noteOf(row));
  };
  const undo = (onAction: () => void) => ({ label: LIST_COPY.toasts.undo, onAction });

  return {
    pinned,
    archived,

    onPin: () => {
      const next = !pinned;
      void setPinned(localId, next).then(() => {
        toast(next ? LIST_COPY.toasts.pinned : LIST_COPY.toasts.unpinned);
      });
    },

    onCopyText: () => {
      const text = bodyToPlainText(doc);
      void (async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast(EDITOR_COPY.copiedAsText);
        } catch {
          // The browser refused (no permission or not a secure page). There is no copy for it in the master.
        }
      })();
    },

    onMakeCopy: () => {
      if (userId === null) return;
      void copyNote(userId, localId).then((saved) => {
        if (saved) toast(LIST_COPY.toasts.copied);
      });
    },

    onArchive: () => {
      const next = !archived;
      void setArchived(localId, next).then(() => {
        void navigate(ROUTES.notes());
        toast(next ? LIST_COPY.toasts.archived : LIST_COPY.toasts.unarchived, {
          action: undo(() => {
            void setArchived(localId, !next).then(reopen);
          }),
        });
      });
    },

    onDelete: () => {
      void moveToTrash(localId).then(() => {
        void navigate(ROUTES.notes());
        toast(LIST_COPY.toasts.deleted, {
          action: undo(() => {
            void restoreNote(localId).then(() => {
              reopen();
              toast(LIST_COPY.toasts.restored);
            });
          }),
        });
      });
    },
  };
}

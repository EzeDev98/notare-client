/** What the note's more menu does. */
import { sessionUserOf } from '@/features/auth/sessionUser';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Doc } from 'yjs';

import { useAuth } from '@/app/providers/auth-context';
import { ROUTES } from '@/app/routes';
import { useToast } from '@/design-system/ui';
import { EDITOR_COPY } from '@/features/editor/editorContent';
import { bodyToPlainText } from '@/features/editor/noteBody';
import {
  copyNote,
  deleteNote,
  restoreOriginal,
  setPinned,
} from '@/features/notes/actions/noteActions';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { routeAfterRemoving } from '@/features/notes/list/visibleOrder';
import type { NoteRow } from '@/features/notes/local/noteRow';

export interface EditorMoreActions {
  pinned: boolean;
  onPin: () => void;
  onCopyText: () => void;
  onMakeCopy: () => void;
  onRestoreOriginal: (() => void) | undefined;
  onDelete: () => void;
  deleteModal: { open: boolean; onClose: () => void; onDelete: () => Promise<boolean> };
}

export function useEditorActions(row: NoteRow, doc: Doc): EditorMoreActions {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { state } = useAuth();
  const userId = sessionUserOf(state)?.id ?? null;
  const [confirming, setConfirming] = useState(false);

  const { localId } = row;
  const pinned = row.pinned === 1;
  const restorable = row.restorable === true && row.dirty === 0;

  return {
    pinned,

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
        } catch {}
      })();
    },

    onMakeCopy: () => {
      if (userId === null) return;
      void copyNote(userId, localId).then((saved) => {
        if (saved) toast(LIST_COPY.toasts.copied);
      });
    },

    onRestoreOriginal: restorable
      ? () => {
          void restoreOriginal(localId).then((restored) => {
            if (!restored) toast(EDITOR_COPY.restoreFailed, { tone: 'error' });
          });
        }
      : undefined,

    onDelete: () => {
      setConfirming(true);
    },

    deleteModal: {
      open: confirming,
      onClose: () => {
        setConfirming(false);
      },
      onDelete: async () => {
        const after = routeAfterRemoving(localId);
        if (!(await deleteNote(localId))) return false;
        void navigate(after ?? ROUTES.notes());
        toast(LIST_COPY.toasts.deleted);
        return true;
      },
    },
  };
}

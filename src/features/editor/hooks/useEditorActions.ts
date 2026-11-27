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
  /** Present only while the note is exactly as AI tidy left it and has no unsent edits. */
  onRestoreOriginal: (() => void) | undefined;
  onDelete: () => void;
  /** The confirmation Delete opens. */
  deleteModal: { open: boolean; onClose: () => void; onDelete: () => Promise<boolean> };
}

/**
 * What the editor's more menu does (master 6.3 and 6.4, step 12e). The words and
 * the actions are the list's own. Delete asks first.
 */
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

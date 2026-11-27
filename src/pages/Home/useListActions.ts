/** What the list row menu does. */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { useToast } from '@/design-system/ui';
import {
  copyNote,
  deleteNote,
  setPinned,
} from '@/features/notes/actions/noteActions';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { routeAfterRemoving } from '@/features/notes/list/visibleOrder';
import type { ListItem } from '@/features/notes/list/listItem';

import type { RowChanges } from './useRowChanges';

export interface ListActions {
  pin: (item: ListItem) => void;
  copy: (item: ListItem) => void;
  delete: (item: ListItem) => void;
}

interface Options {
  ownerId: number;
  openPath: string;
  rows: Pick<RowChanges, 'remove' | 'change'>;
  order: readonly string[];
}

export function useListActions({ ownerId, openPath, rows, order }: Options) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { remove, change } = rows;
  const [deleting, setDeleting] = useState<ListItem | null>(null);

  const closeIfOpen = useCallback(
    (item: ListItem, after: string | null) => {
      if (openPath === item.path) void navigate(after ?? ROUTES.notes());
    },
    [navigate, openPath],
  );

  const actions = useMemo<ListActions>(() => {
    return {
      pin: (item) => {
        const pinned = !item.pinned;
        void change(item.id, { pinned, at: Date.now() }, async () => {
          await setPinned(item.id, pinned);
          toast(pinned ? LIST_COPY.toasts.pinned : LIST_COPY.toasts.unpinned);
        });
      },

      copy: (item) => {
        void copyNote(ownerId, item.id).then((saved) => {
          if (saved) toast(LIST_COPY.toasts.copied);
        });
      },

      delete: setDeleting,
    };
  }, [change, ownerId, toast]);

  const deleteModal = {
    open: deleting !== null,
    onClose: () => {
      setDeleting(null);
    },
    onDelete: async (): Promise<boolean> => {
      if (!deleting) return true;
      const item = deleting;
      const after = routeAfterRemoving(item.id);
      try {
        await remove(item.id, order, async () => {
          if (!(await deleteNote(item.id))) throw new Error('Note not deleted');
          closeIfOpen(item, after);
          toast(LIST_COPY.toasts.deleted);
        });
        return true;
      } catch {
        return false;
      }
    },
  };

  return { actions, deleteModal };
}

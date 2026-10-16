import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES, type NotesView } from '@/app/routes';
import { FEATURES } from '@/core/config/features';
import { useToast } from '@/design-system/ui';
import {
  copyNote,
  leaveNote,
  moveToTrash,
  restoreNote,
  setArchived,
  setPinned,
} from '@/features/notes/actions/noteActions';
import { LIST_COPY } from '@/features/notes/list/listContent';
import type { ListItem } from '@/features/notes/list/listItem';

import type { RowChanges } from './useRowChanges';

export interface ListActions {
  pin: (item: ListItem) => void;
  share: (item: ListItem) => void;
  copy: (item: ListItem) => void;
  archive: (item: ListItem) => void;
  trash: (item: ListItem) => void;
  restore: (item: ListItem) => void;
  /** Undefined while Leave is switched off, which hides it from the menu. */
  leave: ((item: ListItem) => void) | undefined;
}

interface Options {
  ownerId: number;
  view: NotesView;
  /** The path that is open, so a note that goes away takes its screen with it. */
  openPath: string;
  rows: Pick<RowChanges, 'remove' | 'change'>;
  /** The ids on screen, top to bottom. */
  order: readonly string[];
}

/** What each menu item does, with its toast (master 6.3). Nothing here asks for a confirmation but Leave. */
export function useListActions({ ownerId, view, openPath, rows, order }: Options) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { remove, change } = rows;
  const [leaving, setLeaving] = useState<{ item: ListItem; open: boolean } | null>(null);
  const [sharing, setSharing] = useState<{ item: ListItem; open: boolean } | null>(null);

  const actions = useMemo<ListActions>(() => {
    const closeIfOpen = (item: ListItem) => {
      if (openPath === item.path) void navigate(ROUTES.notes(view));
    };
    const undo = (onAction: () => void) => ({ label: LIST_COPY.toasts.undo, onAction });

    return {
      pin: (item) => {
        const pinned = !item.pinned;
        void change(item.id, { pinned, at: Date.now() }, async () => {
          await setPinned(item.id, pinned);
          toast(pinned ? LIST_COPY.toasts.pinned : LIST_COPY.toasts.unpinned);
        });
      },

      share: (item) => {
        // A note that has not reached the server yet cannot be shared; it just opens.
        if (item.serverId === null) void navigate(ROUTES.inView(item.path, view));
        else setSharing({ item, open: true });
      },

      copy: (item) => {
        void copyNote(ownerId, item.id).then((saved) => {
          if (saved) toast(LIST_COPY.toasts.copied);
        });
      },

      archive: (item) => {
        const archived = !item.archived;
        void remove(item.id, order, async () => {
          await setArchived(item.id, archived);
          closeIfOpen(item);
          toast(archived ? LIST_COPY.toasts.archived : LIST_COPY.toasts.unarchived, {
            action: undo(() => {
              void setArchived(item.id, !archived);
            }),
          });
        });
      },

      trash: (item) => {
        void remove(item.id, order, async () => {
          await moveToTrash(item.id);
          closeIfOpen(item);
          toast(LIST_COPY.toasts.deleted, {
            action: undo(() => {
              void restoreNote(item.id).then(() => {
                toast(LIST_COPY.toasts.restored);
              });
            }),
          });
        });
      },

      restore: (item) => {
        void change(item.id, 'gone', async () => {
          await restoreNote(item.id);
          toast(LIST_COPY.toasts.restored, { tone: 'success' });
        });
      },

      leave: FEATURES.leaveNote
        ? (item) => {
            setLeaving({ item, open: true });
          }
        : undefined,
    };
  }, [change, remove, navigate, openPath, order, ownerId, toast, view]);

  const closeShare = () => {
    setSharing((current) => (current ? { ...current, open: false } : current));
  };

  const cancelLeave = () => {
    setLeaving((current) => (current ? { ...current, open: false } : current));
  };

  const confirmLeave = () => {
    if (!leaving) return;
    const { item } = leaving;
    cancelLeave();
    void remove(item.id, order, async () => {
      await leaveNote(item.id);
      if (openPath === item.path) void navigate(ROUTES.notes(view));
      toast(LIST_COPY.toasts.left);
    });
  };

  return { actions, leaving, cancelLeave, confirmLeave, sharing, closeShare };
}

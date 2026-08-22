import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { SidebarNoteItem } from '@/features/notes/components/SidebarNoteItem/SidebarNoteItem';
import './AnimatedSidebarNoteList.css';

const ANIMATION_MS = 440;

interface AnimatedSidebarNoteListProps {
  notes: NoteView[];
  /** Which note the route currently matches, local or server — see
   * SidebarNoteItem's own comment on why these are threaded down rather
   * than left to NavLink's built-in route matching. */
  activeLocalId: string | null;
  activeNoteId: string | null;
  /** Set only during a pending note creation — see AppLayout's own
   * pendingActiveLocalId comment for why. */
  pendingActiveLocalId: string | null;
}

/**
 * Whether ONE row should render as the currently-open note.
 *
 * `pendingActiveLocalId`, when set, overrides route-matching entirely: only
 * the note actually being created counts as active, full stop — not the
 * note the route still technically points at while its own navigate() is
 * deliberately held back (AppLayout's own NOTE_LIFECYCLE_DELAY_MS comment),
 * and not any other row either. Outside that window it falls back to the
 * ordinary "does this row's own route match the current one" check.
 */
function isRowActive(
  note: NoteView,
  activeLocalId: string | null,
  activeNoteId: string | null,
  pendingActiveLocalId: string | null,
): boolean {
  if (pendingActiveLocalId !== null) {
    return note.localId === pendingActiveLocalId;
  }

  return note.serverId === null
    ? note.localId === activeLocalId
    : String(note.serverId) === activeNoteId;
}

interface RenderedNote {
  note: NoteView;
  animationState?: 'enter' | 'exit';
  exitStyle?: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | undefined;
}

interface PendingMove {
  localId: string;
  firstTop: number;
}

export function AnimatedSidebarNoteList({
  notes,
  activeLocalId,
  activeNoteId,
  pendingActiveLocalId,
}: AnimatedSidebarNoteListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const pendingMoveRef = useRef<PendingMove | null>(null);

  const [renderedNotes, setRenderedNotes] = useState<RenderedNote[]>(() =>
    notes.map((note) => ({ note })),
  );

  /*
   * Capture the old position of the ONE neighboring row that should move,
   * then update the rendered list.
   *
   * This is the "First" half of FLIP:
   *
   *   First = old position
   *   Last  = new position
   *   Invert = oldTop - newTop
   *   Play = animate back to zero
   */
  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    setRenderedNotes((previous) => {
      const previousIds = new Set(
        previous.map((item) => item.note.localId),
      );

      const currentIds = new Set(
        notes.map((note) => note.localId),
      );

      const added = notes.filter(
        (note) => !previousIds.has(note.localId),
      );

      const removed = previous.filter(
        (item) => !currentIds.has(item.note.localId),
      );

      /*
       * Ordinary note updates do not animate.
       */
      if (added.length === 0 && removed.length === 0) {
        return notes.map((note) => ({ note }));
      }

      /*
       * Find the ONE existing row that should visibly move.
       *
       * Creation:
       *   new row is inserted at index N.
       *   row N + 1 is the row that gets pushed down.
       *
       * Deletion:
       *   removed row was at index N.
       *   row N becomes the row that moves upward.
       */
      let movedLocalId: string | null = null;

      if (added.length > 0) {
        const addedNote = added[0];

        if (addedNote) {
          const addedIndex = notes.findIndex(
            (note) => note.localId === addedNote.localId,
          );

          if (addedIndex >= 0) {
            movedLocalId =
              notes[addedIndex + 1]?.localId ?? null;
          }
        }
      } else if (removed.length > 0) {
        const removedItem = removed[0];

        if (removedItem) {
          const removedIndex = previous.findIndex(
            (item) =>
              item.note.localId === removedItem.note.localId,
          );

          if (removedIndex >= 0) {
            movedLocalId =
              notes[removedIndex]?.localId ?? null;
          }
        }
      }

      /*
       * Capture the old position BEFORE React changes the layout.
       */
      if (movedLocalId !== null) {
        const element = list.querySelector<HTMLElement>(
          '[data-sidebar-note-id="' + movedLocalId + '"]',
        );

        if (element) {
          pendingMoveRef.current = {
            localId: movedLocalId,
            firstTop: element.getBoundingClientRect().top,
          };
        }
      }

      /*
       * DELETION MOTION:
       *
       * The deleted row must stop occupying layout space immediately.
       * Otherwise the row underneath cannot move until the exit animation
       * finishes, which creates the noticeable delay.
       *
       * Capture the deleted row's exact position now. The temporary visual
       * copy will be absolutely positioned at that location while the real
       * list reflows underneath it immediately.
       */
      const removedExitStyles = new Map<
        string,
        RenderedNote['exitStyle']
      >();

      if (removed.length > 0) {
        const listRect = list.getBoundingClientRect();

        for (const removedItem of removed) {
          const element = list.querySelector<HTMLElement>(
            '[data-sidebar-note-id="' + removedItem.note.localId + '"]',
          );

          if (!element) continue;

          const rect = element.getBoundingClientRect();

          removedExitStyles.set(removedItem.note.localId, {
            top: rect.top - listRect.top + list.scrollTop,
            left: rect.left - listRect.left + list.scrollLeft,
            width: rect.width,
            height: rect.height,
          });
        }
      }

      /*
       * Build the new visual list.
       *
       * New notes get the enter state.
       * Removed notes stay temporarily in the DOM with exit state so the
       * user can actually see them leave.
       */
      const next: RenderedNote[] = [];

      for (const note of notes) {
        if (
          added.some(
            (addedNote) =>
              addedNote.localId === note.localId,
          )
        ) {
          next.push({
            note,
            animationState: 'enter',
          });
        } else {
          next.push({
            note,
          });
        }
      }

      /*
       * Put removed notes back at their previous position temporarily.
       */
      for (const removedItem of removed) {
        const oldIndex = previous.findIndex(
          (item) =>
            item.note.localId === removedItem.note.localId,
        );

        const insertAt =
          oldIndex < 0
            ? next.length
            : Math.min(oldIndex, next.length);

        next.splice(insertAt, 0, {
          note: removedItem.note,
          animationState: 'exit',
          exitStyle: removedExitStyles.get(removedItem.note.localId),
        });
      }

      return next;
    });
  }, [notes]);

  /*
   * The new list has now been committed.
   *
   * Measure the same neighboring row again and animate it from its old
   * position to its new position.
   *
   * This is what creates the real "push down / slide up" effect.
   */
  useLayoutEffect(() => {
    const pending = pendingMoveRef.current;

    if (!pending) {
      return;
    }

    const list = listRef.current;

    if (!list) {
      pendingMoveRef.current = null;
      return;
    }

    const element = list.querySelector<HTMLElement>(
      '[data-sidebar-note-id="' + pending.localId + '"]',
    );

    if (!element) {
      pendingMoveRef.current = null;
      return;
    }

    const lastTop =
      element.getBoundingClientRect().top;

    const deltaY = pending.firstTop - lastTop;

    pendingMoveRef.current = null;

    if (Math.abs(deltaY) < 0.5) {
      return;
    }

    element.animate(
      [
        {
          transform:
            'translate3d(0, ' + deltaY + 'px, 0)',
        },
        {
          transform:
            'translate3d(0, 0, 0)',
        },
      ],
      {
        duration: ANIMATION_MS,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both',
      },
    );
  }, [renderedNotes]);

  /*
   * Remove temporary enter/exit states after the visual transition.
   *
   * This does NOT delete anything from storage.
   * The real note data is still controlled by the notes prop.
   */
  useEffect(() => {
    const hasAnimation = renderedNotes.some(
      (item) =>
        item.animationState === 'enter' ||
        item.animationState === 'exit',
    );

    if (!hasAnimation) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRenderedNotes((current) =>
        current
          .filter(
            (item) =>
              item.animationState !== 'exit',
          )
          .map((item) => ({
            note: item.note,
          })),
      );
    }, ANIMATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [renderedNotes]);

  return (
    <ul
      ref={listRef}
      className="app-shell__note-list"
      role="list"
    >
      {renderedNotes.map((item) => (
        <SidebarNoteItem
          key={item.note.localId}
          note={item.note}
          isActive={isRowActive(item.note, activeLocalId, activeNoteId, pendingActiveLocalId)}
          animationState={item.animationState}
          exitStyle={item.exitStyle}
        />
      ))}
    </ul>
  );
}
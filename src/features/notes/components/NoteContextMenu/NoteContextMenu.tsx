import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import type { NoteView } from '@/features/notes/local/noteMappers';
import './NoteContextMenu.css';

export interface NoteContextMenuActions {
  onNewNote: () => void;
  onDuplicate: (note: NoteView) => void;
  onShare: (note: NoteView) => void;
  onTogglePin: (note: NoteView) => void;
  onToggleArchive: (note: NoteView) => void;
  onDelete: (note: NoteView) => void;
}

interface NoteContextMenuProps {
  note: NoteView;
  /**
   * Viewport coordinates to open at — wherever the pointer was when the
   * browser raised its native `contextmenu` event. Right-click, a
   * two-finger click on a Mac trackpad, and a touch-and-hold long press all
   * raise that exact same event with no way to tell them apart from here
   * (nor any need to — see SidebarNoteItem's own comment on why one
   * `onContextMenu` handler is all three gestures at once).
   */
  x: number;
  y: number;
  actions: NoteContextMenuActions;
  onClose: () => void;
}

/**
 * The floating action menu a sidebar note row opens on right-click /
 * two-finger trackpad click / long-press (SidebarNoteItem wires the native
 * `contextmenu` event to this).
 *
 * POSITIONED, NOT ANCHORED — it opens at the exact pointer position, same as
 * every native OS context menu and unlike NotificationsPanel (anchored
 * under a fixed toolbar button via `position: relative` on its wrapper).
 * `position: fixed` here needs no positioning-context ancestor, which is
 * what makes a single reusable instance workable from AppLayout regardless
 * of where in the sidebar the row that opened it sits, or how far it has
 * scrolled.
 *
 * A NEW MOUNT PER NOTE, not a single persistent instance toggled visible —
 * AppLayout renders this only while its own `contextMenu` state is
 * non-null, keyed implicitly by that state existing at all. That keeps this
 * component itself simple: no "which note, if any, am I for" branching,
 * just the one it was told to open for.
 */
export function NoteContextMenu({ note, x, y, actions, onClose }: NoteContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Starts at the raw pointer position so the very first paint already has
  // *a* position (never 0,0 flashing into place) — see the layout effect
  // below for why it may move slightly before that paint happens.
  const [position, setPosition] = useState({ top: y, left: x });

  /*
   * Clamp to the viewport once the menu has real dimensions.
   *
   * useLayoutEffect, not useEffect: this must run and commit its result
   * BEFORE the browser paints, or a menu opened near the right/bottom edge
   * would visibly flash off-screen for one frame and then jump back —
   * exactly the kind of one-frame flicker RouteTransition.tsx's own
   * hasMounted guard and NoteDetail's loading-spinner delay both exist to
   * avoid elsewhere in this app.
   */
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const margin = 8;
    const rect = menu.getBoundingClientRect();

    const left = Math.min(x, window.innerWidth - rect.width - margin);
    const top = Math.min(y, window.innerHeight - rect.height - margin);

    setPosition({
      left: Math.max(margin, left),
      top: Math.max(margin, top),
    });
  }, [x, y]);

  useEffect(() => {
    function handleOutsideInteraction(event: PointerEvent | MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    /*
     * `contextmenu` gets its own listener, not just `pointerdown` — a
     * right-click on a DIFFERENT row while this menu is still open needs to
     * close THIS one. AppLayout's own state already swaps to the new
     * note's menu regardless (it's a single `contextMenu` slot, not a
     * list), but without this listener that swap would unmount this
     * component from underneath the outside-click check rather than this
     * check ever having run — harmless in practice, but this makes the
     * close explicit instead of incidental.
     *
     * REGISTERED ON THE NEXT TICK, not synchronously — this was a real bug,
     * only visible in a real browser (jsdom's event/effect timing hid it
     * completely, which is how it shipped): the `contextmenu` event that
     * OPENS this menu is still bubbling past this component's own ancestors
     * on its way up to `document` at the moment this effect runs. Attaching
     * the listener synchronously here means that SAME event reaches this
     * brand-new `document` listener a few nodes later in its own bubble
     * phase — read by `handleOutsideInteraction` as "a contextmenu just
     * happened outside the menu" (true in the narrow sense that `row` isn't
     * inside `menuRef`) and closing the menu that same event just opened,
     * instantly, before the menu ever paints. Deferring registration past
     * the current task means it only ever sees the NEXT contextmenu/click/
     * keydown, never the one already in flight.
     */
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleOutsideInteraction);
      document.addEventListener('contextmenu', handleOutsideInteraction);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleOutsideInteraction);
      document.removeEventListener('contextmenu', handleOutsideInteraction);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // onClose is intentionally omitted: AppLayout passes a fresh inline
    // closure each render (`() => setContextMenu(null)`), and re-subscribing
    // on every render for a stable value would be pure churn. Nothing here
    // depends on note/x/y either — this effect only cares about "outside" and
    // "Escape", not which note the menu is currently for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = deriveNoteLabel(note.content).label;
  const canShare = note.serverId !== null;

  function runAndClose(action: () => void) {
    action();
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className="note-context-menu"
      role="menu"
      aria-label={`Actions for ${label}`}
      style={{ top: `${String(position.top)}px`, left: `${String(position.left)}px` }}
    >
      <button
        type="button"
        role="menuitem"
        className="note-context-menu__item"
        onClick={() => {
          runAndClose(actions.onNewNote);
        }}
      >
        New note
      </button>

      <button
        type="button"
        role="menuitem"
        className="note-context-menu__item"
        onClick={() => {
          runAndClose(() => {
            actions.onDuplicate(note);
          });
        }}
      >
        Duplicate note
      </button>

      <button
        type="button"
        role="menuitem"
        className="note-context-menu__item"
        disabled={!canShare}
        title={canShare ? undefined : "This note hasn't finished saving yet"}
        onClick={() => {
          if (!canShare) return;
          runAndClose(() => {
            actions.onShare(note);
          });
        }}
      >
        Share note
      </button>

      <button
        type="button"
        role="menuitem"
        className="note-context-menu__item"
        onClick={() => {
          runAndClose(() => {
            actions.onTogglePin(note);
          });
        }}
      >
        {note.pinned ? 'Unpin note' : 'Pin note'}
      </button>

      <button
        type="button"
        role="menuitem"
        className="note-context-menu__item"
        onClick={() => {
          runAndClose(() => {
            actions.onToggleArchive(note);
          });
        }}
      >
        {note.archived ? 'Unarchive note' : 'Archive note'}
      </button>

      <button
        type="button"
        role="menuitem"
        className="note-context-menu__item note-context-menu__item--danger"
        onClick={() => {
          runAndClose(() => {
            actions.onDelete(note);
          });
        }}
      >
        Delete
      </button>
    </div>
  );
}

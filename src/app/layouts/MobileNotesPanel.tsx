import type { AnimationEventHandler } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { AnimatedSidebarNoteList } from '@/features/notes/components/AnimatedSidebarNoteList/AnimatedSidebarNoteList';
import './MobileNotesPanel.css';

interface MobileNotesPanelProps {
  notes: NoteView[] | undefined;
  activeLocalId: string | null;
  activeNoteId: string | null;
  pendingActiveLocalId: string | null;
  onNoteContextMenu: (note: NoteView, x: number, y: number) => void;
  contextMenuNoteLocalId: string | null;
  onClose: () => void;
  isClosing: boolean;
  onAnimationEnd: AnimationEventHandler<HTMLDivElement>;
  /*
   * Below 640px only (see this component's own CSS) — the toolbar no
   * longer carries New note/Delete at that width (AppLayout.css's mobile
   * decluttering), so this panel's own header takes over both, in the
   * left/left/right arrangement asked for: New note and Delete on the
   * left, Cancel on the right. At 640-1023px these three props are still
   * passed but never rendered — that range keeps the original title +
   * close header untouched, below.
   */
  onCreateNote: () => void;
  onDeleteActive: () => void;
  hasActiveNote: boolean;
}

/**
 * Responsive layout plan, Step 13. Below 1024px there was no way to reach
 * the live note list at all — `.app-shell__sidebar` (AppLayout.tsx's own
 * top comment) is desktop-only by design, same as `.app-shell__folders`,
 * and neither the compact nav nor the toolbar ever stood in for it. This
 * is that missing access point: a full-screen takeover, opened from the
 * toolbar's folders-toggle button (repurposed below 1024px only — see
 * that button's own comment in AppLayout.tsx), closed the same four ways
 * Modal.tsx's dialog is: the X here, Escape, picking a note (this file
 * doesn't handle that — AppLayout's own route-change effect does, since
 * every note link navigates), or AppLayout's outside-tap handling.
 *
 * Reuses AnimatedSidebarNoteList exactly as the desktop sidebar does —
 * same props, same component, not a second copy. Deliberately does NOT
 * add its own "New note" button (the toolbar's compose icon already
 * works at every width — Step 2) or a theme toggle (that's a separate
 * toolbar control now, unfolding in place the same way search does — see
 * AppLayout.tsx's own comment on isThemeToggleExpanded): this panel's
 * only job is the one thing that was actually missing, browsing notes.
 *
 * Not a portal, unlike Modal — `position: fixed` here calculates against
 * the viewport regardless of where in the tree this mounts, since nothing
 * in `.app-shell`'s ancestry sets `transform`/`filter`/`contain` (only
 * `overflow: hidden`, which doesn't create a containing block for `fixed`
 * descendants). Same reasoning NotificationsPanel's own comment already
 * gives for skipping a portal.
 */
export function MobileNotesPanel({
  notes,
  activeLocalId,
  activeNoteId,
  pendingActiveLocalId,
  onNoteContextMenu,
  contextMenuNoteLocalId,
  onClose,
  isClosing,
  onAnimationEnd,
  onCreateNote,
  onDeleteActive,
  hasActiveNote,
}: MobileNotesPanelProps) {
  return (
    <div
      className="mobile-notes-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Notes"
      data-closing={isClosing || undefined}
      onAnimationEnd={onAnimationEnd}
    >
      {/*
        Two headers, one DOM, CSS-swapped by breakpoint — the same rule
        AppLayout.tsx's own compact-nav/sidebar split already follows.
        Below 640px this panel is the 50%-width slide-in (MobileNotesPanel.css),
        and its header becomes New note + Delete (left) / Cancel (right) —
        see mobile-notes-panel__mobile-header's own CSS comment for why.
        At 640-1023px it's the original full-screen title + close.
      */}
      <header className="mobile-notes-panel__header">
        <h2 className="mobile-notes-panel__title">Notes</h2>
        <button
          type="button"
          className="mobile-notes-panel__close"
          aria-label="Close notes"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>

        <div className="mobile-notes-panel__mobile-header">
          <div className="mobile-notes-panel__mobile-actions">
            <button
              type="button"
              className="mobile-notes-panel__icon-btn"
              aria-label="New note"
              onClick={onCreateNote}
            >
              <Plus aria-hidden="true" />
            </button>
            <button
              type="button"
              className="mobile-notes-panel__icon-btn"
              aria-label="Delete note"
              disabled={!hasActiveNote}
              onClick={onDeleteActive}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="mobile-notes-panel__icon-btn mobile-notes-panel__cancel"
            aria-label="Cancel"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mobile-notes-panel__body">
        {/*
          Same "undefined for one instant before Dexie's first answer"
          reasoning as the desktop sidebar's own comment — nothing renders
          for that instant rather than flashing an empty state first.
        */}
        {notes && notes.length > 0 ? (
          <AnimatedSidebarNoteList
            notes={notes}
            activeLocalId={activeLocalId}
            activeNoteId={activeNoteId}
            pendingActiveLocalId={pendingActiveLocalId}
            onNoteContextMenu={onNoteContextMenu}
            contextMenuNoteLocalId={contextMenuNoteLocalId}
          />
        ) : null}

        {notes && notes.length === 0 ? (
          <p className="mobile-notes-panel__empty">No notes yet.</p>
        ) : null}
      </div>
    </div>
  );
}

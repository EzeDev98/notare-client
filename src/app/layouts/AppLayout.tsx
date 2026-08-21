import {
  type AnimationEvent,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router';
import {
  Archive,
  Bell,
  Handshake,
  PanelLeft,
  Search,
  Share,
  SquarePen,
  Trash2,
  NotebookPen,
  Users,
} from 'lucide-react';

import { navItems, type NavItem } from '@/app/layouts/navItems';
import { RouteFocus } from '@/app/RouteFocus';
import { RouteTransition } from '@/app/RouteTransition';
import { useAuth } from '@/app/providers/auth-context';
import { useFoldersPanel } from '@/app/layouts/useFoldersPanel';
import { useSidebarWidth } from '@/app/layouts/useSidebarWidth';
import { AnimatedSidebarNoteList } from '@/features/notes/components/AnimatedSidebarNoteList/AnimatedSidebarNoteList';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { createLocalNote, toView } from '@/features/notes/local/noteMappers';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { NotificationsPanel } from '@/features/notifications/components/NotificationsPanel/NotificationsPanel';
import { useSync } from '@/sync/useSync';
import { useConflictCount } from '@/sync/useConflicts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { ThemeToggle } from '@/design-system/components/ThemeToggle/ThemeToggle';
import { Modal } from '@/design-system/components/Modal/Modal';
import './AppLayout.css';

/*
 * Archived, Trash, Voice, Shared with me, Collaboration, Account — the FOLDERS PANEL's
 * contents now (moved out of the note-list sidebar's own footer). Still
 * defined here rather than in navItems.tsx, same reasoning as before:
 * navItems.tsx drives the <1024px compact nav and stays exactly as it
 * already was, so mobile/tablet — which has no folders panel at all —
 * are untouched.
 */
const desktopOnlyItems: NavItem[] = [
  {
    to: '/archived',
    label: 'Archived',
    icon: <Archive aria-hidden="true" />,
  },
  {
    to: '/trash',
    label: 'Trash',
    icon: <Trash2 aria-hidden="true" />,
  },
];

// Everything BUT Notes, plus Archived/Trash — the folders panel's full
// contents. Derived here rather than edited into navItems.tsx: navItems
// itself stays untouched and still exactly matches what the compact nav
// below renders, so there is no second four-item list to keep in sync by
// hand, and mobile/tablet cannot silently grow past four icons.
//
// Shared with me is NOT part of navItems (that array drives the <1024px
// compact nav too, and Shared has no place in that unchanged four-item
// list) — it's inserted here directly, between Shared with me and Account, so it
// picks up the same NavLink rendering as everything else in this panel
// without navItems.tsx growing a fifth entry mobile/tablet never asked for.
const sharedWithMeItem: NavItem = {
  to: '/shared',
  label: 'Shared with me',
  icon: <Users aria-hidden="true" />,
};

const voiceNotesItem: NavItem = {
  ...navItems.find((item) => item.to === '/voice')!,
  label: 'Voice notes',
};

const collaborationItem: NavItem = {
  to: '/collaborations',
  label: 'Collaborations',
  icon: <Handshake aria-hidden="true" />,
};

const accountItem: NavItem = {
  ...navItems.find((item) => item.to === '/account/sessions')!,
  label: 'Accounts',
};

const foldersNavItems = [
  voiceNotesItem,
  sharedWithMeItem,
  collaborationItem,
  ...desktopOnlyItems,
  accountItem,
];

/**
 * The authenticated application shell.
 *
 * Three layouts from one DOM structure, entirely in CSS:
 *   < 640px    bottom bar
 *   640-1023   icon-only rail
 *   >= 1024    sidebar with labels
 *
 * No JavaScript, no resize listeners, no state. A media query has no render
 * cost and cannot get out of sync with the viewport, which a
 * useWindowWidth hook can and does — it is wrong on the first paint and again
 * on every orientation change until the listener fires.
 *
 * STEP 4D wraps this route's element in <RequireAuth>.
 *
 * THE SIDEBAR NOTE LIST (desktop only). At >=1024px, "Notes" no longer
 * exists as a nav destination — the sidebar itself lists every note live,
 * with a "New note" entry pinned at the top, Archived/Trash/Voice/Shared
 * with me/Account pinned at the bottom below the scrollable list, and the
 * theme toggle below that.
 *
 * ONLY at >=1024px. A live, scrollable note list cannot fit in a 56px
 * icon rail or a mobile bottom bar without redesigning those layouts
 * outright — so <1024px keeps the ORIGINAL four-item nav (Notes/Voice/
 * Notifications/Account) completely unchanged, via
 * `.app-shell__compact-nav`. The underlying routes (`/notes`, `/archived`,
 * `/trash`) are untouched too and still fully reachable by direct URL —
 * nothing about them was removed, only which nav links point where at
 * the one breakpoint that now shows the notes inline instead.
 */
export function AppLayout() {
  const navigate = useNavigate();

  /*
   * Drag-to-resize (>=1024px only — the handle below is hidden at every
   * other breakpoint via CSS). --sidebar-width drives BOTH
   * .app-shell's grid-template-columns and .app-shell__toolbar-nav's own
   * width, so the toolbar's left segment and the sidebar column stay
   * exactly aligned as the person drags — the same "+" intersection this
   * shell has always drawn between them, just at a width that now moves.
   *
   * dragStateRef, not more useState: the drag start point and start width
   * only matter WHILE a drag is in progress, read once per pointermove to
   * compute the next width from the pointer's absolute position (not
   * accumulated deltas, which drift under fast movement). A ref avoids a
   * render on every mousedown for a value nothing displays.
   */
  const { width: sidebarWidth, setWidth: setSidebarWidth } = useSidebarWidth();
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStateRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;
    const delta = event.clientX - dragStateRef.current.startX;
    setSidebarWidth(dragStateRef.current.startWidth + delta);
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /*
   * The folders panel — Archived/Trash/Voice/Shared with me/Account, the
   * theme toggle — collapsed by default, toggled from the button at the
   * toolbar's own top-left corner (below), and drag-resizable while open
   * via its own handle, same pointer-capture pattern as the sidebar's.
   */
  const { isOpen: isFoldersOpen, toggle: toggleFolders, width: foldersWidth, setWidth: setFoldersWidth } =
    useFoldersPanel();
  const foldersDragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function handleFoldersResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    foldersDragStateRef.current = { startX: event.clientX, startWidth: foldersWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleFoldersResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!foldersDragStateRef.current) return;
    const delta = event.clientX - foldersDragStateRef.current.startX;
    setFoldersWidth(foldersDragStateRef.current.startWidth + delta);
  }

  function handleFoldersResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    foldersDragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  // The width actually applied to the grid column — 0 while closed, so
  // the panel visually collapses to nothing rather than sitting empty at
  // its remembered width. The width itself (foldersWidth) stays whatever
  // it was dragged to, unaffected by toggling — reopening restores it.
  const appliedFoldersWidth = isFoldersOpen ? foldersWidth : 0;

  /*
   * The toolbar's Share icon acts on WHATEVER note is currently open —
   * there is no other way for a persistent, always-mounted toolbar to
   * know that, since the note id lives in a CHILD route's params
   * (/notes/:noteId, rendered through <Outlet/> below), not in
   * AppLayout's own. useMatch reads the current URL against that pattern
   * directly, which is the same thing useParams does one level down,
   * just usable from a parent.
   *
   * Only matches the bare /notes/:noteId route, not /notes/new or
   * /notes/:noteId/share themselves — sharing "the note you're sharing"
   * or "the note you're about to create" is not a real action.
   */
  const noteDetailMatch = useMatch('/notes/:noteId');
  const matchedNoteIdParam = noteDetailMatch?.params['noteId'];
  // Same validation parseNoteId (useNote.ts) applies — useMatch has no
  // concept of a numeric param, it matches any string in that segment.
  const activeNoteId =
    matchedNoteIdParam !== undefined && /^\d+$/.test(matchedNoteIdParam) ? matchedNoteIdParam : null;

  /*
   * The toolbar's Delete icon needs the same "whatever note is currently
   * open" reach as Share above, but for BOTH note routes — a note without a
   * serverId yet lives at /notes/local/:localId (see NoteCard's routing
   * comment), and it must be just as deletable as one that has synced.
   *
   * Share only needed the id (to build a Link). Delete needs the actual row
   * — useDeleteNote takes a NoteView, which carries title/version/updatedAt
   * for the trash toast and the server PATCH — so this reads Dexie directly
   * rather than re-deriving a NoteView from a bare id string.
   */
  const localNoteMatch = useMatch('/notes/local/:localId');
  const activeLocalId = localNoteMatch?.params['localId'] ?? null;

  /*
   * A newly-created local note is disposable until the user actually puts
   * something in it.
   *
   * When navigation leaves /notes/local/:localId, inspect the note we just
   * left. If it is still local-only and completely blank, remove it from
   * Dexie immediately.
   *
   * This deliberately does NOT use the editor's save lifecycle and does NOT
   * touch server-backed notes. It is purely the "I created a blank note and
   * changed my mind" navigation rule.
   */
  const previousActiveLocalIdRef = useRef<string | null>(activeLocalId);

  useEffect(() => {
    const previousLocalId = previousActiveLocalIdRef.current;

    if (previousLocalId !== null && previousLocalId !== activeLocalId) {
      void noteRepository.getByLocalId(previousLocalId).then((row) => {
        if (
          row &&
          row.serverId === null &&
          row.deleted === 0 &&
          row.title.trim() === '' &&
          row.content.trim() === ''
        ) {
          void noteRepository.hardDelete(previousLocalId);
        }
      });
    }

    previousActiveLocalIdRef.current = activeLocalId;
  }, [activeLocalId]);

  const activeNoteRow = useLiveQuery(async () => {
    if (activeLocalId !== null) {
      return (await noteRepository.getByLocalId(activeLocalId)) ?? null;
    }
    if (activeNoteId !== null) {
      return (await noteRepository.getByServerId(Number(activeNoteId))) ?? null;
    }
    return null;
  }, [activeLocalId, activeNoteId]);

  const deleteNote = useDeleteNote();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  async function handleDeleteActiveNote() {
    if (!activeNoteRow) return;

    await deleteNote(toView(activeNoteRow));

    // The route the user was just on now points at a trashed note — same
    // "something left the screen" case setArchived's toast comment already
    // names, except here there is nowhere left on this route to redraw.
    // /notes always has somewhere sane to land, whichever of the two note
    // routes the icon was clicked from.
    navigate('/notes');
    setDeleteModalOpen(false);
  }

  /*
   * Uncontrolled would be simpler, but the field must be CLEARABLE from
   * code too — landing back on this layout after a search shouldn't leave
   * stale text sitting in the toolbar's own box, out of sync with
   * whatever /search is actually showing.
   */
  const [toolbarSearchTerm, setToolbarSearchTerm] = useState('');

  /*
   * Step 1 (notifications rework). The bell used to be a bare
   * `<Link to="/notifications">` — nothing to toggle, so a second click
   * did nothing and the only way "out" was navigating elsewhere or a full
   * refresh. Now it opens `NotificationsPanel` in place, and this is
   * everything responsible for closing it again.
   *
   * `notificationsRef` covers the button AND the panel together (the
   * panel renders as a sibling inside the same wrapper div below, not a
   * portal — see the panel's own CSS comment on why) — "outside" means
   * outside that whole unit, not just outside the panel, otherwise
   * clicking the bell itself while open would register as an outside
   * click and immediately reopen it.
   */
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsClosing, setNotificationsClosing] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const requestNotificationsClose = useCallback(() => {
    if (!notificationsOpen || notificationsClosing) return;
    setNotificationsClosing(true);
  }, [notificationsOpen, notificationsClosing]);

  function handleNotificationsAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (
      event.animationName !== 'ds-notifications-panel-exit' ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    setNotificationsOpen(false);
    setNotificationsClosing(false);
  }

  useEffect(() => {
    if (!notificationsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (notificationsRef.current?.contains(event.target as Node)) return;
      requestNotificationsClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestNotificationsClose();
      }
    }

    // Listening only while open, not unconditionally on mount.
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen, requestNotificationsClose]);

  // Route changes use the same exit lifecycle instead of unmounting
  // the panel immediately.
  useEffect(() => {
    requestNotificationsClose();
  }, [location.pathname, requestNotificationsClose]);

  function handleToolbarSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = toolbarSearchTerm.trim();
    navigate(trimmed === '' ? '/search' : `/search?q=${encodeURIComponent(trimmed)}`);
  }

  /*
   * Here, not in AuthProvider: this component only ever mounts for an
   * authenticated session (RequireAuth wraps its route), so "the shell
   * mounted" already means "we have a session worth syncing for" — no
   * separate check needed. It also naturally stops on logout: the shell
   * unmounts, the effect's cleanup runs, and there is no dangling listener
   * trying to sync with no session behind it.
   *
   * ownerId comes from auth context the same way useNotes reads it (7A) —
   * pull.ts needs it the moment a brand-new row is written, not whenever a
   * later screen happens to ask.
   */
  const { state: authState } = useAuth();
  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;
  useSync(ownerId);

  /*
   * 8E. A count, not the full list — this mounts on EVERY authenticated
   * route, and pulling in useConflicts' resolution API (and re-rendering on
   * every field of every conflicted note) here just to know whether a
   * banner should show would be wasted work on every screen that isn't
   * /conflicts.
   */
  const conflictCount = useConflictCount(ownerId);

  /*
   * 8F. Same restraint the conflict banner and SaveIndicator both already
   * use: 'idle' (the resting state — last run succeeded, nothing pending)
   * shows NOTHING. A permanent "Synced" pill on every screen is chrome
   * competing with content for a fact nobody asked about; 'syncing' /
   * 'offline' / 'error' are the only states worth a line of text.
   */
  const syncStatus = useSyncStatus();
  const syncMessage =
    syncStatus.status === 'syncing'
      ? { label: 'Syncing…', tone: 'quiet' as const }
      : syncStatus.status === 'offline'
        ? { label: "Offline — you're working locally", tone: 'warn' as const }
        : syncStatus.status === 'error'
          ? { label: 'Sync trouble — retrying', tone: 'danger' as const }
          : null;

  // Same hook, same query the "Notes" list already used (archived: false
  // by default) — the sidebar list and NotesLandingPage read the same
  // live Dexie query, so there is exactly one source of truth for "what
  // are my notes" and the two never disagree.
  const { notes } = useNotes();

  const emptyNote = notes?.find(
    (note) => note.serverId === null && isEmptyNote(note),
  );

  const hasEmptyNote = emptyNote !== undefined;

  return (
    <div
      className="app-shell"
      style={
        {
          '--sidebar-width': `${String(sidebarWidth)}px`,
          '--folders-width': `${String(appliedFoldersWidth)}px`,
        } as CSSProperties
      }
    >
      <RouteFocus targetId="main" />

      {syncMessage ? (
        <p className="app-shell__sync-status" aria-hidden="true" data-tone={syncMessage.tone}>
          {syncMessage.label}
        </p>
      ) : null}
      {/*
        Always rendered so the region exists before it has content — same
        reasoning SaveIndicator.tsx gives for its own live region: a region
        added at the same moment as its text is frequently not announced.
        Only 'offline' and 'error' interrupt; 'syncing' is routine progress,
        exactly as SaveIndicator treats its own 'saving'.
      */}
      <p className="ds-visually-hidden" role="status">
        {syncMessage && syncStatus.status !== 'syncing' ? syncMessage.label : ''}
      </p>

      {conflictCount > 0 ? (
        /*
         * role="alert": a conflict is exactly the interruption ConflictPanel
         * already treats as one (§38) — announced immediately, not queued
         * behind whatever a screen reader happens to be reading.
         */
        <div className="app-shell__conflict-banner" role="alert">
          <p>
            {conflictCount} {conflictCount === 1 ? 'note has' : 'notes have'} a conflict that
            needs your attention.
          </p>
          <NavLink className="app-shell__conflict-link" to="/conflicts">
            Review
          </NavLink>
        </div>
      ) : null}
      {/*
        Visually hidden until focused, then the first thing a keyboard user
        reaches. Without it they tab through the whole nav on every page before
        reaching content — a cost paid on every navigation, by exactly the
        people who can least afford it.
      */}
      <a className="app-shell__skip" href="#main">
        Skip to content
      </a>

      {/*
        STEP 1 of the desktop toolbar. Structural only — no icons yet.
        Empty and display:none below 1024px, same media-query-only pattern
        the rest of this three-layouts-in-one-DOM shell already uses (this
        file's own top comment). At >=1024px it becomes the full-width bar
        above BOTH the sidebar and the content, which is why it lives here
        as a sibling of nav/main rather than inside either — nothing that
        spans both columns can be a child of one of them.
      */}
      <div className="app-shell__toolbar">
        {/*
          Same 240px as .app-shell__nav's inline-size, so this segment's
          border-inline-end lines up exactly above nav's own border below
          it — the two borders read as one line crossing the toolbar's
          border-block-end, the "+" intersection at the sidebar's top
          corner in the target design, instead of two unrelated lines that
          happen to be near each other.

          Trash lives here, right-aligned against that border — the icon
          sits on the SIDEBAR's side of the intersection, matching the
          reference. Acts on whichever note is currently open, the same
          "note above `activeNoteId`" pattern the Share icon below uses —
          see the activeNoteRow comment further down for why Delete needs
          the full row rather than just an id.
        */}
        <div className="app-shell__toolbar-nav">
          {/*
            THE toggle for the folders panel — Archived/Trash/Voice/
            Shared with me/Account, the theme toggle — collapsed by
            default, opened from here. Always the first thing in the
            toolbar's top-left corner regardless of the panel's own
            state, matching the reference exactly: this button's
            position never moves, only what's behind it does.
          */}
          <button
            type="button"
            className="app-shell__toolbar-icon-btn"
            aria-label={isFoldersOpen ? 'Hide folders' : 'Show folders'}
            aria-pressed={isFoldersOpen}
            onClick={toggleFolders}
          >
            <PanelLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="app-shell__toolbar-icon-btn"
            aria-label="Delete note"
            disabled={activeNoteRow == null}
            onClick={() => {
              setDeleteModalOpen(true);
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>

        {/*
          Compose sits on the CONTENT side of the same intersection, right
          against .app-shell__toolbar-nav's border — "beside" the trash
          icon across that line, matching the reference. A real Link to
          /notes/new, not a placeholder: that route already exists and the
          sidebar's own "New note" button already points at it, so there is
          no reason for this one to be inert too.
        */}
        <div className="app-shell__toolbar-main">
          <button
            type="button"
            className="app-shell__toolbar-icon-btn"
            aria-label="New note"
            aria-disabled={hasEmptyNote}
            data-unavailable={hasEmptyNote || undefined}
            onClick={async () => {
              if (hasEmptyNote) {
                return;
              }

              if (
                authState.status !== 'authenticated' &&
                authState.status !== 'refreshing'
              ) {
                return;
              }

              const row = {
                ...createLocalNote(authState.user.id),
                dirty: 0 as const,
                syncState: 'synced' as const,
              };

              await noteRepository.put(row);

              void navigate(`/notes/local/${row.localId}`, {
                replace: true,
                state: { skipEnterAnimation: true },
              });
            }}
          >
            <SquarePen aria-hidden="true" />
          </button>

          {/*
            Right-aligned group, reference order: notifications, then
            share, then search last against the toolbar's own trailing
            edge. Notifications is a toggle button now, not a Link — see
            the `notificationsOpen` state and its two effects above for
            why. The full `/notifications` page this used to link to
            directly still exists and is still reachable, both by URL and
            via the panel's own "View all" link.

            Share now does what NoteDetail's old inline "Share" text link
            used to (that link is gone — this icon replaces it entirely,
            per note above `activeNoteId`). Enabled only while a note is
            actually open: `disabled`, not omitted, so the icon's position
            in the toolbar never shifts as you navigate in and out of a
            note.
          */}
          <div className="app-shell__toolbar-actions">
            <div className="app-shell__notifications" ref={notificationsRef}>
              <button
                type="button"
                className="app-shell__toolbar-icon-btn"
                aria-label="Notifications"
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  if (notificationsClosing) return;

                  if (notificationsOpen) {
                    requestNotificationsClose();
                    return;
                  }

                  setNotificationsClosing(false);
                  setNotificationsOpen(true);
                }}
              >
                <Bell aria-hidden="true" />
              </button>

              {notificationsOpen || notificationsClosing ? (
                <NotificationsPanel
                  onClose={requestNotificationsClose}
                  isClosing={notificationsClosing}
                  onAnimationEnd={handleNotificationsAnimationEnd}
                />
              ) : null}
            </div>

            {activeNoteId !== null ? (
              <Link
                to={`/notes/${activeNoteId}/share`}
                className="app-shell__toolbar-icon-btn"
                aria-label="Share this note"
              >
                <Share aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="app-shell__toolbar-icon-btn"
                aria-label="Share this note"
                disabled
              >
                <Share aria-hidden="true" />
              </button>
            )}

            <form
              className="app-shell__toolbar-search"
              role="search"
              onSubmit={handleToolbarSearchSubmit}
            >
              <Search aria-hidden="true" />
              <input
                type="search"
                placeholder="Search"
                aria-label="Search your notes"
                value={toolbarSearchTerm}
                onChange={(event) => {
                  setToolbarSearchTerm(event.target.value);
                }}
              />
            </form>
          </div>
        </div>
      </div>

      {/*
        THE FOLDERS PANEL — >=1024px only, collapsed by default. Its own
        grid column (--folders-width, 0 while closed), separate from the
        note-list sidebar below rather than a section within it: this is
        a distinct region (account-level navigation — Archived, Trash,
        Voice, Shared with me, Account, the theme toggle) that can be
        hidden entirely, where the note list underneath it cannot.
        `inert` while closed — not just clipped via overflow:hidden on
        the CSS side — so its links are neither focusable nor announced
        while the panel is width:0 and visually gone; CSS alone hides
        content but does not remove it from the tab order or a screen
        reader's view.
      */}
      <nav className="app-shell__folders" aria-label="Folders" inert={!isFoldersOpen}>
        <ul className="app-shell__bottom-nav" role="list">
          {foldersNavItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className="app-shell__nav-link">
                <span className="app-shell__nav-icon">{item.icon}</span>
                <span className="app-shell__nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/*
          The one control for useTheme() in the whole app — see
          ThemeToggle's own doc comment. Placed below the nav group
          rather than inside .app-shell__bottom-nav's <ul>: it isn't a
          navigation destination, it's a setting, and mixing the two
          into one semantic list would tell a screen reader "here are
          five links" for something that is five links and a radio
          group.
        */}
        <div className="app-shell__theme-toggle">
          <ThemeToggle />
        </div>
      </nav>

      {/*
        The folders panel's OWN resize handle — only rendered while open;
        dragging the edge of a width:0 panel has nothing to drag.
      */}
      {isFoldersOpen ? (
        <div
          className="app-shell__folders-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize folders panel"
          onPointerDown={handleFoldersResizePointerDown}
          onPointerMove={handleFoldersResizePointerMove}
          onPointerUp={handleFoldersResizePointerUp}
        />
      ) : null}

      {/*
        Nav is FIRST in the DOM at every breakpoint and moves to the bottom
        visually on mobile via flex `order`.

        The trade: keyboard order follows the DOM, so on mobile a keyboard user
        reaches the bottom bar before the content. Unusual, but consistent
        across breakpoints and answered by the skip link above. Putting content
        first would fix mobile and give desktop a stranger problem — Tab
        reaching the sidebar only AFTER the entire page.
      */}
      <nav className="app-shell__nav" aria-label="Main">
        {/*
          COMPACT NAV — <1024px only. The original four items, completely
          unchanged, so the mobile bottom bar and tablet icon rail behave
          exactly as they did before this file's own top comment describes
          why: no room for a note list at those sizes.
        */}

        {/* DESKTOP SIDEBAR — >=1024px only. See this file's own top comment. */}
        <div className="app-shell__sidebar">
          {/*
            `notes` is `undefined` for one instant before Dexie's first
            answer (useNotes' own doc comment on why that is distinct from
            an empty array) — rendering nothing for that instant rather
            than an empty-state message avoids a flash of "no notes" on
            every single authenticated page load.
          */}
          {notes && notes.length > 0 ? (
            <AnimatedSidebarNoteList notes={notes} />
          ) : null}

          {notes && notes.length === 0 ? (
            <p className="app-shell__note-list-empty">No notes yet.</p>
          ) : null}
        </div>
      </nav>

      {/*
        The drag-to-resize handle — >=1024px only (AppLayout.css hides it
        below that, same as everything else scoped to the sidebar
        breakpoint). Absolutely positioned against .app-shell rather than
        given its own grid column: a column would mean redefining
        grid-template-columns as three tracks instead of two just to fit
        a handle a few pixels wide, for no benefit over positioning it at
        the boundary the existing two-column grid already has.
      */}
      <div
        className="app-shell__resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
      />

      {deleteModalOpen ? (
        <Modal
          title=""
          description={
            <>
              Are you sure you want to delete
              <br />
              the selected note?
            </>
          }
          icon={<NotebookPen aria-hidden="true" />}
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setDeleteModalOpen(false);
            },
          }}
          primaryAction={{
            label: 'Delete',
            onClick: () => {
              void handleDeleteActiveNote();
            },
          }}
          onClose={() => {
            setDeleteModalOpen(false);
          }}
        />
      ) : null}

      {/* The ONLY scroll container. A page-level scroll would drift the
          editor toolbar off-screen while writing. */}
      {/* tabIndex={-1}: focusable by RouteFocus, but not a tab stop. */}
      <main className="app-shell__main" id="main" tabIndex={-1}>
        <RouteTransition>
          <Outlet />
        </RouteTransition>
      </main>
    </div>
  );
}

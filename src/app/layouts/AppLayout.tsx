import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from 'react';
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router';
import { Bell, Search, Share, SquarePen, Trash2 } from 'lucide-react';

import { navItems, type NavItem } from '@/app/layouts/navItems';
import { RouteFocus } from '@/app/RouteFocus';
import { useAuth } from '@/app/providers/auth-context';
import { useFoldersPanel } from '@/app/layouts/useFoldersPanel';
import { useSidebarWidth } from '@/app/layouts/useSidebarWidth';
import { SidebarNoteItem } from '@/features/notes/components/SidebarNoteItem/SidebarNoteItem';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useSync } from '@/sync/useSync';
import { useConflictCount } from '@/sync/useConflicts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { Logo } from '@/design-system/components/Logo/Logo';
import { ThemeToggle } from '@/design-system/components/ThemeToggle/ThemeToggle';
import './AppLayout.css';

/*
 * Archived, Trash, Voice, Notifications, Account — the FOLDERS PANEL's
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
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="5" rx="1.5" />
        <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
        <path d="M10 13h4" />
      </svg>
    ),
  },
  {
    to: '/trash',
    label: 'Trash',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h16" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    ),
  },
];

// Everything BUT Notes, plus Archived/Trash — the folders panel's full
// contents. Derived here rather than edited into navItems.tsx: navItems
// itself stays untouched and still exactly matches what the compact nav
// below renders, so there is no second four-item list to keep in sync by
// hand, and mobile/tablet cannot silently grow past four icons.
const foldersNavItems = [...desktopOnlyItems, ...navItems.filter((item) => item.to !== '/notes')];

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
 * with a "New note" entry pinned at the top, Archived/Trash/Voice/
 * Notifications/Account pinned at the bottom below the scrollable list,
 * and the theme toggle below that.
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
   * The folders panel — Archived/Trash/Voice/Notifications/Account, the
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
   * Uncontrolled would be simpler, but the field must be CLEARABLE from
   * code too — landing back on this layout after a search shouldn't leave
   * stale text sitting in the toolbar's own box, out of sync with
   * whatever /search is actually showing.
   */
  const [toolbarSearchTerm, setToolbarSearchTerm] = useState('');

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
  // Shown at the top of the folders panel — see that section's own JSX.
  const currentUserEmail =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.email
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
          reference. Not wired to an action yet: this step is placement
          only, same as the sidebar's own Trash nav item started as a
          plain link before anything pointed at it.
        */}
        <div className="app-shell__toolbar-nav">
          {/*
            THE toggle for the folders panel — Archived/Trash/Voice/
            Notifications/Account, the theme toggle — collapsed by
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <Logo />
          <button type="button" className="app-shell__toolbar-icon-btn" aria-label="Delete note">
            <Trash2 aria-hidden="true" strokeWidth={1.75} />
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
          <Link to="/notes/new" className="app-shell__toolbar-icon-btn" aria-label="New note">
            <SquarePen aria-hidden="true" strokeWidth={1.75} />
          </Link>

          {/*
            Right-aligned group, reference order: notifications, then
            share, then search last against the toolbar's own trailing
            edge. Notifications is a real Link — /notifications already
            exists and is one of the four routes the compact nav below
            already points at.

            Share now does what NoteDetail's old inline "Share" text link
            used to (that link is gone — this icon replaces it entirely,
            per note above `activeNoteId`). Enabled only while a note is
            actually open: `disabled`, not omitted, so the icon's position
            in the toolbar never shifts as you navigate in and out of a
            note.
          */}
          <div className="app-shell__toolbar-actions">
            <Link
              to="/notifications"
              className="app-shell__toolbar-icon-btn"
              aria-label="Notifications"
            >
              <Bell aria-hidden="true" strokeWidth={1.75} />
            </Link>

            {activeNoteId !== null ? (
              <Link
                to={`/notes/${activeNoteId}/share`}
                className="app-shell__toolbar-icon-btn"
                aria-label="Share this note"
              >
                <Share aria-hidden="true" strokeWidth={1.75} />
              </Link>
            ) : (
              <button
                type="button"
                className="app-shell__toolbar-icon-btn"
                aria-label="Share this note"
                disabled
              >
                <Share aria-hidden="true" strokeWidth={1.75} />
              </button>
            )}

            <form
              className="app-shell__toolbar-search"
              role="search"
              onSubmit={handleToolbarSearchSubmit}
            >
              <Search aria-hidden="true" strokeWidth={1.75} />
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
        Voice, Notifications, Account, the theme toggle) that can be
        hidden entirely, where the note list underneath it cannot.
        `inert` while closed — not just clipped via overflow:hidden on
        the CSS side — so its links are neither focusable nor announced
        while the panel is width:0 and visually gone; CSS alone hides
        content but does not remove it from the tab order or a screen
        reader's view.
      */}
      <nav className="app-shell__folders" aria-label="Folders" inert={!isFoldersOpen}>
        <p className="app-shell__folders-account">{currentUserEmail}</p>

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
        <ul className="app-shell__compact-nav" role="list">
          {navItems.map((item) => (
            <li key={item.to}>
              {/*
                NavLink sets aria-current="page" when active. The CSS styles
                that same attribute rather than a class, so what is announced
                and what is highlighted cannot drift apart.
              */}
              <NavLink to={item.to} className="app-shell__nav-link">
                <span className="app-shell__nav-icon">{item.icon}</span>
                <span className="app-shell__nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

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
            <ul className="app-shell__note-list" role="list">
              {notes.map((note) => (
                <SidebarNoteItem key={note.localId} note={note} />
              ))}
            </ul>
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

      {/* The ONLY scroll container. A page-level scroll would drift the
          editor toolbar off-screen while writing. */}
      {/* tabIndex={-1}: focusable by RouteFocus, but not a tab stop. */}
      <main className="app-shell__main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

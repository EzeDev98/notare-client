import { Link, NavLink, Outlet } from 'react-router';

import { navItems, type NavItem } from '@/app/layouts/navItems';
import { RouteFocus } from '@/app/RouteFocus';
import { useAuth } from '@/app/providers/auth-context';
import { SidebarNoteItem } from '@/features/notes/components/SidebarNoteItem/SidebarNoteItem';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useSync } from '@/sync/useSync';
import { useConflictCount } from '@/sync/useConflicts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { Logo } from '@/design-system/components/Logo/Logo';
import './AppLayout.css';

/*
 * Archived and Trash, DESKTOP SIDEBAR ONLY — defined here rather than in
 * navItems.tsx, same reasoning as bottomNavItems below: navItems.tsx
 * drives the <1024px compact nav and stays exactly as it already was, so
 * mobile/tablet are untouched (this file's own top comment on why those
 * breakpoints keep the original four items rather than growing to six).
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

// Everything BUT Notes, plus Archived/Trash — the desktop sidebar's bottom
// group. Derived here rather than edited into navItems.tsx: navItems
// itself stays untouched and still exactly matches what the compact nav
// below renders, so there is no second four-item list to keep in sync by
// hand, and mobile/tablet cannot silently grow past four icons.
const bottomNavItems = [...desktopOnlyItems, ...navItems.filter((item) => item.to !== '/notes')];

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
 * with a "New note" entry pinned at the top, and Archived/Trash/Voice/
 * Notifications/Account pinned at the bottom below the scrollable list.
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

  return (
    <div className="app-shell">
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
          Only actually visible at the >=1024px sidebar breakpoint
          (AppLayout.css) — the icon rail and mobile bottom bar are both
          too cramped for a wordmark, and the nav items themselves already
          carry enough identity at those sizes. display:none below
          1024px, same media-query-only approach the rest of this
          three-layouts-in-one-DOM shell already uses (this file's own
          top comment).
        */}
        <div className="app-shell__brand" aria-hidden="true">
          <Logo withWordmark />
        </div>

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
          <Link to="/notes/new" className="app-shell__new-note">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>New note</span>
          </Link>

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

          <ul className="app-shell__bottom-nav" role="list">
            {bottomNavItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className="app-shell__nav-link">
                  <span className="app-shell__nav-icon">{item.icon}</span>
                  <span className="app-shell__nav-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* The ONLY scroll container. A page-level scroll would drift the
          editor toolbar off-screen while writing. */}
      {/* tabIndex={-1}: focusable by RouteFocus, but not a tab stop. */}
      <main className="app-shell__main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet } from 'react-router';

import { navItems } from '@/app/layouts/navItems';
import { RouteFocus } from '@/app/RouteFocus';
import { useAuth } from '@/app/providers/auth-context';
import { useSync } from '@/sync/useSync';
import { useConflictCount } from '@/sync/useConflicts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import './AppLayout.css';

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
        <ul className="app-shell__nav-list" role="list">
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

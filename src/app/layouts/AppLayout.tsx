import { Outlet, NavLink } from 'react-router';

/**
 * The authenticated application shell.
 *
 * <Outlet /> is where the matched child route renders. Everything AROUND it —
 * navigation now, sync status and the notification bell later — stays mounted
 * across navigations. That persistence is the point: a sync indicator that
 * remounted on every route change would lose its state and flicker each time
 * the user opened a note.
 *
 * STEP 4D wraps this route's element in <RequireAuth>. Doing it here rather
 * than inside each page means a new route added under this layout is protected
 * by virtue of where it sits, and cannot be accidentally left public.
 *
 * Unstyled on purpose — the design system arrives in Step 2, and inventing
 * colours and spacing now would mean replacing them in a week.
 */
export function AppLayout() {
  return (
    <div>
      <nav aria-label="Main">
        <NavLink to="/notes">Notes</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

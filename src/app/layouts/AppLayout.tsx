import { NavLink, Outlet } from 'react-router';

import { navItems } from '@/app/layouts/navItems';
import { RouteFocus } from '@/app/RouteFocus';
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
  return (
    <div className="app-shell">
      <RouteFocus targetId="main" />
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

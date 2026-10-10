import { NavLink } from 'react-router';

import './NoteTabs.css';
import { ROUTES } from '@/app/routes';

/**
 * Three views of the same collection.
 *
 * Separate ROUTES rather than a filter in component state, because they are
 * genuinely different screens with different actions — a trashed note has
 * restore and delete-forever, not pin and archive — and because
 * /archived is worth linking to and going back to.
 *
 * Links, not buttons: they navigate. Styling them as tabs is presentation;
 * making them <button role="tab"> would mean reimplementing arrow-key
 * navigation and losing middle-click, for no gain.
 *
 * Rendered only on the Notes page (/notes). Archived and Trash are each a
 * single, self-contained view of their own collection — once you're on one
 * of them, switching views again goes through the folders panel (desktop)
 * or back through Notes (mobile/tablet), not a second set of tabs repeated
 * on every screen.
 */
export function NoteTabs() {
  return (
    <nav className="note-tabs" aria-label="Note views">
      <NavLink className="note-tabs__tab" to={ROUTES.notes()} end>
        Notes
      </NavLink>
      <NavLink className="note-tabs__tab" to={ROUTES.legacy.archived()}>
        Archived
      </NavLink>
      <NavLink className="note-tabs__tab" to={ROUTES.legacy.trash()}>
        Trash
      </NavLink>
    </nav>
  );
}

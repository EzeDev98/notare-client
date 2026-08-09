import { NavLink } from 'react-router';

import './NoteTabs.css';

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
 */
export function NoteTabs() {
  return (
    <nav className="note-tabs" aria-label="Note views">
      <NavLink className="note-tabs__tab" to="/notes" end>
        Notes
      </NavLink>
      <NavLink className="note-tabs__tab" to="/archived">
        Archived
      </NavLink>
      <NavLink className="note-tabs__tab" to="/trash">
        Trash
      </NavLink>
    </nav>
  );
}

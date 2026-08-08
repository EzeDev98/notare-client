import { Link } from 'react-router';

/**
 * Deep linking and PWA reloads make this reachable more often than it looks:
 * any URL the router does not match lands here, including a stale bookmark to
 * a note that has since been deleted.
 */
export function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link to="/notes">Back to your notes</Link>
    </main>
  );
}

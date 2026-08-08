/**
 * Shown while the router resolves a lazy route on FIRST load — when the user
 * lands directly on a URL whose module is not in the initial bundle.
 *
 * Only needed for that initial case. On a normal in-app navigation React
 * Router keeps the current screen rendered until the next one is ready, which
 * is why route transitions do not flash.
 *
 * Deliberately plain text, not a spinner: Step 2 replaces this with a skeleton,
 * and a spinner now would be a decision made without a design system.
 */
export function RouteFallback() {
  return <p>Loading…</p>;
}

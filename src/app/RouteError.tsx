import { useRouteError, isRouteErrorResponse } from 'react-router';

/**
 * Rendered in place of a route that threw.
 *
 * Attached to the LAYOUT routes rather than the router root, so the shell
 * survives and only the content area shows the failure. A single app-level
 * boundary would blank the entire screen because a notification panel broke.
 *
 * isRouteErrorResponse distinguishes an error React Router itself produced —
 * a 404 from no matching route, a thrown Response — from an exception a
 * component threw while rendering. They need different wording, and the
 * narrowing is a type guard: inside the branch, `error` is a
 * ErrorResponse rather than `unknown`.
 *
 * Step 3 replaces the generic message with the typed ApiError model, and
 * Step 2 gives this an actual design. For now it exists so that a thrown
 * error produces something legible instead of a blank page.
 */
export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <section>
        <h1>{error.status}</h1>
        <p>{error.statusText}</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Something went wrong</h1>
      <p>This screen failed to load. Try again, or go back.</p>
    </section>
  );
}

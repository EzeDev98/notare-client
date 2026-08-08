import { RouterProvider } from 'react-router';
import { router } from '@/app/router';

/**
 * The composition root.
 *
 * Nothing but wiring lives here — no layout, no state, no data. Providers
 * (auth, theme, query client, sync) get added around RouterProvider as later
 * steps introduce them, which is exactly why this file stays this small: it is
 * the one place that knows what the application is ASSEMBLED from.
 */
export function App() {
  return <RouterProvider router={router} />;
}

import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { AppLayout } from '@/app/layouts/AppLayout';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { RouteError } from '@/app/RouteError';
import { RouteFallback } from '@/app/RouteFallback';
import { LoginPage } from '@/pages/Login/Login';

/**
 * The route tree, as DATA.
 *
 * createBrowserRouter takes plain objects rather than nested <Route> JSX. The
 * difference matters more than it looks: the tree can be type-checked,
 * inspected and reasoned about without rendering anything, which is closer to
 * a Spring WebMvcConfigurer than to a template.
 *
 * `satisfies RouteObject[]` rather than `: RouteObject[]` — it checks the shape
 * without widening the inferred type, so a typo in a property name is an error
 * while the literal keeps its precise type for anything that reads it later.
 *
 * SHAPE:
 *   /               redirect to /notes
 *   (public)        login, and in Step 4: register, verify, password reset
 *   (app shell)     everything requiring a session
 *   *               404
 */
const routes = [
  {
    /*
     * Layout route with no path: it contributes chrome and an error boundary
     * but no URL segment, so its children sit at the top level.
     */
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        /*
         * `replace` so the redirect does not sit in history — without it, Back
         * from /notes lands on "/", which redirects to /notes again, and the
         * user is trapped.
         */
        element: <Navigate to="/notes" replace />,
      },
      {
        path: 'login',
        /*
         * EAGER, unlike everything below. An unauthenticated visitor needs
         * this screen immediately, and code-splitting it would add a network
         * round trip before the very first render.
         */
        element: <LoginPage />,
      },
    ],
  },

  {
    /*
     * The authenticated shell. STEP 4D wraps this element in <RequireAuth>;
     * that one change protects every child route, present and future.
     */
    element: <AppLayout />,
    errorElement: <RouteError />,
    HydrateFallback: RouteFallback,
    children: [
      {
        path: 'notes',
        /*
         * LAZY: the module is fetched on navigation rather than shipped in the
         * initial bundle. Two consequences worth knowing now — the first visit
         * to this route costs a round trip, and an offline user who has never
         * visited it gets nothing until the service worker precaches route
         * chunks in Step 11.
         */
        lazy: async () => {
          const { NotesPage } = await import('@/pages/Notes/Notes');
          return { Component: NotesPage };
        },
      },
    ],
  },

  {
    /*
     * Outside both layouts, so an unknown URL does not imply a session by
     * rendering the authenticated shell around itself.
     */
    path: '*',
    lazy: async () => {
      const { NotFoundPage } = await import('@/pages/NotFound/NotFound');
      return { Component: NotFoundPage };
    },
  },
] satisfies RouteObject[];

export const router = createBrowserRouter(routes);

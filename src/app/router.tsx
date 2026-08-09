import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { AppLayout } from '@/app/layouts/AppLayout';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { RouteError } from '@/app/RouteError';
import { RouteFallback } from '@/app/RouteFallback';
import { LoginPage } from '@/pages/Login/Login';

/**
 * The route tree, as DATA. `satisfies` checks the shape without widening, so a
 * typo in a property name is an error while the literal keeps its precise type.
 */
const routes = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/notes" replace /> },
      // Eager: an unauthenticated visitor needs this immediately, and
      // code-splitting it adds a round trip before the first render.
      { path: 'login', element: <LoginPage /> },
    ],
  },

  {
    /*
     * The 4D seam, now filled. RequireAuth wraps the layout, so every child
     * route — present and future — is protected by placement rather than by a
     * check somebody has to remember to add.
     */
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppLayout />,
        HydrateFallback: RouteFallback,
        children: [
          {
            path: 'notes',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
              return { Component: NotesPage };
            },
          },
        ],
      },
    ],
  },

  {
    // Outside both layouts, so an unknown URL does not imply a session by
    // rendering the authenticated shell around itself.
    path: '*',
    lazy: async () => {
      const { NotFoundPage } = await import('@/pages/NotFound/NotFound');
      return { Component: NotFoundPage };
    },
  },
] satisfies RouteObject[];

export const router = createBrowserRouter(routes);

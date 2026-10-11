import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { PublicLayout } from '@/app/layouts/PublicLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { RouteError } from '@/app/RouteError';
import { RouteFallback } from '@/app/RouteFallback';
import { ROUTE_ENTRIES, ROUTE_REDIRECTS, type RouteEntry } from '@/app/routeConfig';
import { ROUTES, ROUTE_PATTERNS } from '@/app/routes';
import { Shell } from '@/app/shell/Shell';

/*
 * The tree is built from routeConfig.tsx: a route sits under the signed-in
 * layout or the public one according to its requiresAuth flag, so a route
 * cannot be protected or public by accident of where it was typed.
 *
 * React Router ranks static segments ('/notes/new') over dynamic ones
 * ('/notes/:noteId') whatever the array order.
 */
const toRoute = (entry: RouteEntry): RouteObject => ({
  path: entry.path,
  lazy: async () => ({ Component: await entry.load() }),
});

const redirects: RouteObject[] = ROUTE_REDIRECTS.map((r) => ({
  path: r.from,
  element: <Navigate to={r.to} replace />,
}));

export const routes = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to={ROUTES.notes()} replace /> },
      ...redirects,
      ...ROUTE_ENTRIES.filter((e) => !e.guards.requiresAuth).map(toRoute),
    ],
  },

  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <Shell />,
        HydrateFallback: RouteFallback,
        children: ROUTE_ENTRIES.filter((e) => e.guards.requiresAuth).map(toRoute),
      },
    ],
  },

  // Dev only. Dropped from the production build.
  ...(import.meta.env.DEV
    ? [
        {
          path: 'dev/tokens',
          lazy: async () => ({ Component: (await import('@/dev/tokens/TokensPage')).TokensPage }),
        },
        {
          path: 'dev/gallery',
          lazy: async () => ({
            Component: (await import('@/dev/gallery/GalleryPage')).GalleryPage,
          }),
        },
        {
          path: 'dev/motion',
          lazy: async () => ({ Component: (await import('@/dev/motion/MotionPage')).MotionPage }),
        },
      ]
    : []),

  {
    path: ROUTE_PATTERNS.notFound,
    lazy: async () => {
      const { NotFoundPage } = await import('@/pages/NotFound/NotFound');
      return { Component: NotFoundPage };
    },
  },
] satisfies RouteObject[];

export const router = createBrowserRouter(routes);

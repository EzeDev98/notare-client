/** Builds the router from the route list. */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { PublicLayout } from '@/app/layouts/PublicLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { RouteError } from '@/app/RouteError';
import { RouteFallback } from '@/app/RouteFallback';
import { ROUTE_ENTRIES, ROUTE_REDIRECTS, type RouteEntry } from '@/app/routeConfig';
import { ROUTES, ROUTE_PATTERNS } from '@/app/routes';
import { Shell } from '@/app/shell/Shell';

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

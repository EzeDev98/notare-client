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

      /*
       * Lazy, unlike login: these are visited once per account, so paying a
       * round trip for them keeps the initial bundle smaller for the screen
       * every returning user actually sees.
       */
      {
        path: 'register',
        lazy: async () => {
          const { RegisterPage } = await import('@/pages/Register/Register');
          return { Component: RegisterPage };
        },
      },
      {
        path: 'reset-password',
        lazy: async () => {
          const { ResetPasswordPage } = await import('@/pages/ResetPassword/ResetPassword');
          return { Component: ResetPasswordPage };
        },
      },
      {
        path: 'verify',
        lazy: async () => {
          const { VerifyAccountPage } = await import('@/pages/VerifyAccount/VerifyAccount');
          return { Component: VerifyAccountPage };
        },
      },
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
            path: 'account/sessions',
            lazy: async () => {
              const { SessionsPage } = await import('@/pages/Sessions/Sessions');
              return { Component: SessionsPage };
            },
          },
          {
            /*
             * Registered BEFORE the collection route for readability only —
             * React Router matches by specificity, not order, so 'notes/:noteId'
             * and 'notes' cannot shadow each other. (MSW does not share that
             * property, which is why tests/msw/handlers.ts is order-sensitive.)
             */
            path: 'notes/:noteId',
            lazy: async () => {
              const { NoteDetailPage } = await import('@/pages/NoteDetail/NoteDetail');
              return { Component: NoteDetailPage };
            },
          },
          {
            path: 'notes',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
              return { Component: NotesPage };
            },
          },

          /*
           * 7E. NoteTabs has linked to both of these since Step 5 and both
           * rendered the 404 page, because the route tree was never told they
           * existed — the pages' own tests mounted them in a memory router, so
           * nothing failed. A test that builds its own routes proves the page
           * works, not that the app can reach it.
           */
          {
            path: 'archived',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
              /*
               * A route cannot pass props to a `Component`, so the prop is
               * bound here. The wrapper is created ONCE, when lazy resolves and
               * the router caches the result — not per render, which would give
               * React a new component type each time and remount the page on
               * every state change.
               */
              return { Component: () => <NotesPage archived /> };
            },
          },
          {
            path: 'trash',
            lazy: async () => {
              const { TrashPage } = await import('@/pages/Trash/Trash');
              return { Component: TrashPage };
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

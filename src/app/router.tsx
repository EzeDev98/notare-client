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
 *
 * Exported (not just the router built from it) so router.test.tsx can mount
 * the REAL tree in a memory router. D1 survived as long as it did because
 * every page's own test built its own throwaway route — proving the page
 * works, not that the app can reach it.
 */
export const routes = [
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
             * 7D. Registered before 'notes/:noteId' for readability only —
             * React Router ranks a static segment ('new') above a dynamic one
             * (':noteId') regardless of array order, so this cannot be
             * shadowed. The bug was never route order; it was that this path
             * had no route object at all, so ':noteId' was the only thing
             * that could match and 'new' was captured as an id.
             */
            path: 'notes/new',
            lazy: async () => {
              const { NewNotePage } = await import('@/pages/NewNote/NewNote');
              return { Component: NewNotePage };
            },
          },
          {
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
           * NoteTabs has linked to both of these since Step 5. Fixed in 7D
           * (b10fdce).
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
          {
            // 7D. Same defect as 'archived'/'trash': the page and its own
            // test existed since Step 5; nothing in the real tree pointed to it.
            path: 'search',
            lazy: async () => {
              const { SearchPage } = await import('@/pages/Search/Search');
              return { Component: SearchPage };
            },
          },
          {
            // 8E. Cold-start conflicts (a push or a pull marking a note
            // 'conflict' with nobody looking at it) had nowhere to go until
            // this route existed — see the gap analysis, D-series.
            path: 'conflicts',
            lazy: async () => {
              const { ConflictsPage } = await import('@/pages/Conflicts/Conflicts');
              return { Component: ConflictsPage };
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

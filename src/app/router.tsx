import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { AppLayout } from '@/app/layouts/AppLayout';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { RouteError } from '@/app/RouteError';
import { RouteFallback } from '@/app/RouteFallback';
import { LoginPage } from '@/pages/Login/Login';

export const routes = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/notes" replace /> },
      { path: 'login', element: <LoginPage /> },
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
            path: 'notes/:noteId/share',
            lazy: async () => {
              const { ShareNotePage } = await import('@/pages/ShareNote/ShareNote');
              return { Component: ShareNotePage };
            },
          },
          {
            path: 'notes',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
              return { Component: NotesPage };
            },
          },
          {
            path: 'archived',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
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
            path: 'search',
            lazy: async () => {
              const { SearchPage } = await import('@/pages/Search/Search');
              return { Component: SearchPage };
            },
          },
          {
            path: 'conflicts',
            lazy: async () => {
              const { ConflictsPage } = await import('@/pages/Conflicts/Conflicts');
              return { Component: ConflictsPage };
            },
          },
          {
            path: 'shared',
            lazy: async () => {
              const { SharedNotesPage } = await import('@/pages/SharedNotes/SharedNotes');
              return { Component: SharedNotesPage };
            },
          },
          {
            path: 'shared/:noteId',
            lazy: async () => {
              const { SharedNotePage } = await import('@/pages/SharedNote/SharedNote');
              return { Component: SharedNotePage };
            },
          },
          {
            path: 'collaborations',
            lazy: async () => {
              const { InvitationsPage } = await import('@/pages/Invitations/Invitations');
              return { Component: InvitationsPage };
            },
          },
          {
            // 9C, master-brief lettering ("User search and the invite
            // flow"). Static segment after a static parent, registered
            // here for the same readability convention as 'notes/new'
            // before 'notes/:noteId' — no shadowing risk regardless of
            // order since both are literal paths.
            path: 'collaborations/invite',
            lazy: async () => {
              const { InviteCollaboratorPage } = await import(
                '@/pages/InviteCollaborator/InviteCollaborator'
              );
              return { Component: InviteCollaboratorPage };
            },
          },
          {
            // 9F. "Notifications: client-composed wording, unknown-type
            // fallback, unread count polling, mark-read" — architecture
            // doc §4.2 names the route and its actions verbatim: "list,
            // unread filter, mark read, mark all, delete".
            path: 'notifications',
            lazy: async () => {
              const { NotificationsPage } = await import('@/pages/Notifications/Notifications');
              return { Component: NotificationsPage };
            },
          },
        ],
      },
    ],
  },

  {
    path: '*',
    lazy: async () => {
      const { NotFoundPage } = await import('@/pages/NotFound/NotFound');
      return { Component: NotFoundPage };
    },
  },
] satisfies RouteObject[];

export const router = createBrowserRouter(routes);

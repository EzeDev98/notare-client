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
            // Registered before 'notes/:noteId' for readability only, same
            // convention as 'notes/new' above and 'voice' below — React
            // Router ranks the static 'local' segment over the dynamic
            // :noteId param regardless of array order.
            path: 'notes/local/:localId',
            lazy: async () => {
              const { LocalNoteDetailPage } = await import('@/pages/NoteDetail/LocalNoteDetail');
              return { Component: LocalNoteDetailPage };
            },
          },
          {
            path: 'notes/local/:localId',
            lazy: async () => {
              const { LocalNoteDetailPage } = await import(
                '@/pages/LocalNoteDetail/LocalNoteDetail'
              );
              return { Component: LocalNoteDetailPage };
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
              const { NotesLandingPage } = await import('@/pages/NotesLanding/NotesLanding');
              return { Component: NotesLandingPage };
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
            // Step 13. A sibling of 'shared/:noteId' rather than nested
            // under it — parallels the existing '/shared/:id' vs
            // '/voice/:id' split (two distinct id spaces) instead of
            // implying a voice note is a kind of note.
            path: 'shared-voice/:voiceNoteId',
            lazy: async () => {
              const { SharedVoiceDetailPage } = await import(
                '@/pages/SharedVoiceDetail/SharedVoiceDetail'
              );
              return { Component: SharedVoiceDetailPage };
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
            path: 'collaborations/invite',
            lazy: async () => {
              const { InviteCollaboratorPage } = await import(
                '@/pages/InviteCollaborator/InviteCollaborator'
              );
              return { Component: InviteCollaboratorPage };
            },
          },
          {
            path: 'notifications',
            lazy: async () => {
              const { NotificationsPage } = await import('@/pages/Notifications/Notifications');
              return { Component: NotificationsPage };
            },
          },
          {
            // Step 10. Registered before 'voice/:voiceNoteId' for
            // readability only, same convention as 'notes/new' before
            // 'notes/:noteId' — React Router ranks the static route
            // regardless of array order.
            path: 'voice',
            lazy: async () => {
              const { VoiceNotesPage } = await import('@/pages/VoiceNotes/VoiceNotes');
              return { Component: VoiceNotesPage };
            },
          },
          {
            path: 'voice/:voiceNoteId',
            lazy: async () => {
              const { VoiceDetailPage } = await import('@/pages/VoiceDetail/VoiceDetail');
              return { Component: VoiceDetailPage };
            },
          },
          {
            // Step 11. Same placement convention as 'notes/:noteId/share'
            // right after 'notes/:noteId' above.
            path: 'voice/:voiceNoteId/share',
            lazy: async () => {
              const { ShareVoiceNotePage } = await import('@/pages/ShareVoiceNote/ShareVoiceNote');
              return { Component: ShareVoiceNotePage };
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

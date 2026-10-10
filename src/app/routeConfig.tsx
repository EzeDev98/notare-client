import type { ComponentType } from 'react';

import { LoginPage } from '@/pages/Login/Login';

import { ROUTE_PATTERNS as P } from './routes';

/**
 * One list of every route with its guard flags (S-12). router.tsx builds the
 * tree from this and decides which layout a route sits under; screens never
 * declare their own guards.
 *
 * requiresAuth        signed-out visitors are sent to sign in (RequireAuth).
 * publicOnly          signed-in visitors are sent into the app.
 * requiresOnboarding  a signed-in visitor who has not finished the install
 *                     steps is sent to /install.
 *
 * Only requiresAuth is enforced today. publicOnly and requiresOnboarding are
 * declared here now and enforced by the single start-up decision in 7c.
 */
export interface RouteGuards {
  requiresAuth: boolean;
  publicOnly: boolean;
  requiresOnboarding: boolean;
}

export interface RouteEntry {
  path: string;
  guards: RouteGuards;
  load: () => Promise<ComponentType>;
}

const SIGNED_OUT: RouteGuards = {
  requiresAuth: false,
  publicOnly: true,
  requiresOnboarding: false,
};
const OPEN: RouteGuards = { requiresAuth: false, publicOnly: false, requiresOnboarding: false };
const APP: RouteGuards = { requiresAuth: true, publicOnly: false, requiresOnboarding: true };

/*
 * Routes with a screen today. Welcome, /install and /settings/* are added by
 * the steps that build those screens (8, 9, 15); each is one line here.
 */
export const ROUTE_ENTRIES: RouteEntry[] = [
  { path: P.signIn, guards: SIGNED_OUT, load: () => Promise.resolve(LoginPage) },
  {
    path: P.register,
    guards: SIGNED_OUT,
    load: () => import('@/pages/Register/Register').then((m) => m.RegisterPage),
  },
  {
    path: P.resetPassword,
    guards: SIGNED_OUT,
    load: () => import('@/pages/ResetPassword/ResetPassword').then((m) => m.ResetPasswordPage),
  },
  // An emailed link can be opened while signed in, so verify is not publicOnly.
  {
    path: P.verify,
    guards: OPEN,
    load: () => import('@/pages/VerifyAccount/VerifyAccount').then((m) => m.VerifyAccountPage),
  },

  {
    path: P.notes,
    guards: APP,
    load: () => import('@/pages/NotesLanding/NotesLanding').then((m) => m.NotesLandingPage),
  },
  {
    path: P.note,
    guards: APP,
    load: () => import('@/pages/NoteDetail/NoteDetail').then((m) => m.NoteDetailPage),
  },

  // Old screens. Each line goes when its screen is rebuilt.
  {
    path: P.legacy.noteNew,
    guards: APP,
    load: () => import('@/pages/NewNote/NewNote').then((m) => m.NewNotePage),
  },
  {
    path: P.legacy.noteLocal,
    guards: APP,
    load: () => import('@/pages/NoteDetail/LocalNoteDetail').then((m) => m.LocalNoteDetailPage),
  },
  {
    path: P.legacy.noteShare,
    guards: APP,
    load: () => import('@/pages/ShareNote/ShareNote').then((m) => m.ShareNotePage),
  },
  {
    path: P.legacy.archived,
    guards: APP,
    load: () => import('@/pages/Notes/Notes').then((m) => () => <m.NotesPage archived />),
  },
  {
    path: P.legacy.trash,
    guards: APP,
    load: () => import('@/pages/Trash/Trash').then((m) => m.TrashPage),
  },
  {
    path: P.legacy.search,
    guards: APP,
    load: () => import('@/pages/Search/Search').then((m) => m.SearchPage),
  },
  {
    path: P.legacy.shared,
    guards: APP,
    load: () => import('@/pages/SharedNotes/SharedNotes').then((m) => m.SharedNotesPage),
  },
  {
    path: P.legacy.sharedNote,
    guards: APP,
    load: () => import('@/pages/SharedNote/SharedNote').then((m) => m.SharedNotePage),
  },
  {
    path: P.legacy.sharedVoice,
    guards: APP,
    load: () =>
      import('@/pages/SharedVoiceDetail/SharedVoiceDetail').then((m) => m.SharedVoiceDetailPage),
  },
  {
    path: P.legacy.collaborations,
    guards: APP,
    load: () => import('@/pages/Invitations/Invitations').then((m) => m.InvitationsPage),
  },
  {
    path: P.legacy.collaborationsInvite,
    guards: APP,
    load: () =>
      import('@/pages/InviteCollaborator/InviteCollaborator').then((m) => m.InviteCollaboratorPage),
  },
  {
    path: P.legacy.notifications,
    guards: APP,
    load: () => import('@/pages/Notifications/Notifications').then((m) => m.NotificationsPage),
  },
  {
    path: P.legacy.voice,
    guards: APP,
    load: () => import('@/pages/VoiceNotes/VoiceNotes').then((m) => m.VoiceNotesPage),
  },
  {
    path: P.legacy.voiceDetail,
    guards: APP,
    load: () => import('@/pages/VoiceDetail/VoiceDetail').then((m) => m.VoiceDetailPage),
  },
  {
    path: P.legacy.voiceShare,
    guards: APP,
    load: () => import('@/pages/ShareVoiceNote/ShareVoiceNote').then((m) => m.ShareVoiceNotePage),
  },
  {
    path: P.legacy.accountSessions,
    guards: APP,
    load: () => import('@/pages/Sessions/Sessions').then((m) => m.SessionsPage),
  },
];

/** Old URLs kept for one release so bookmarks and emailed links still work. */
export const ROUTE_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: P.oldSignIn, to: P.signIn },
  { from: P.oldResetPassword, to: P.resetPassword },
];

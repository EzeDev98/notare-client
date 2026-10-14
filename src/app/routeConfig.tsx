import type { ComponentType } from 'react';

import { LoginPage } from '@/pages/Login/Login';

import { ROUTE_PATTERNS as P, ROUTES } from './routes';

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
  {
    path: P.welcome,
    guards: SIGNED_OUT,
    load: () => import('@/pages/Welcome/Welcome').then((m) => m.WelcomePage),
  },
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
  {
    path: P.settings,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsHub').then((m) => m.SettingsHubPage),
  },
  {
    path: P.settingsAccount,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsAccount').then((m) => m.SettingsAccountPage),
  },
  {
    path: P.settingsAppearance,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsAppearance').then((m) => m.SettingsAppearancePage),
  },
  {
    path: P.settingsSync,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsSync').then((m) => m.SettingsSyncPage),
  },
  {
    path: P.settingsDevices,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsDevices').then((m) => m.SettingsDevicesPage),
  },
  {
    path: P.settingsSecurity,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsSecurity').then((m) => m.SettingsSecurityPage),
  },
  {
    path: P.settingsDeleted,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsDeleted').then((m) => m.SettingsDeletedPage),
  },
  {
    path: P.settingsAbout,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsAbout').then((m) => m.SettingsAboutPage),
  },
  {
    path: P.settingsTerms,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsLegal').then((m) => m.SettingsTermsPage),
  },
  {
    path: P.settingsPrivacy,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsLegal').then((m) => m.SettingsPrivacyPage),
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
    path: P.legacy.sharedNote,
    guards: APP,
    load: () => import('@/pages/SharedNote/SharedNote').then((m) => m.SharedNotePage),
  },
  {
    path: P.legacy.collaborationsInvite,
    guards: APP,
    load: () =>
      import('@/pages/InviteCollaborator/InviteCollaborator').then((m) => m.InviteCollaboratorPage),
  },
];

/** Old URLs kept for one release so bookmarks and emailed links still work. */
export const ROUTE_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: P.oldSignIn, to: P.signIn },
  { from: P.oldResetPassword, to: P.resetPassword },
  { from: P.legacy.archived, to: ROUTES.notes('archived') },
  { from: P.legacy.search, to: ROUTES.notes() },
  { from: P.legacy.shared, to: ROUTES.notes('shared') },
  { from: P.legacy.collaborations, to: ROUTES.notes('shared') },
  { from: P.legacy.notifications, to: ROUTES.notes() },
  { from: P.legacy.accountSessions, to: ROUTES.settingsDevices() },
];

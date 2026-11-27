/** Every route with its guard flags. */
import type { ComponentType } from 'react';

import { LoginPage } from '@/pages/Login/Login';

import { ROUTE_PATTERNS as P, ROUTES } from './routes';

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
    path: P.settingsGeneral,
    guards: APP,
    load: () => import('@/pages/Settings/SettingsGeneral').then((m) => m.SettingsGeneralPage),
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
];

export const ROUTE_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: P.oldSignIn, to: P.signIn },
  { from: P.oldResetPassword, to: P.resetPassword },
  { from: P.legacy.archived, to: ROUTES.notes() },
  { from: P.legacy.search, to: ROUTES.notes() },
  { from: P.legacy.notifications, to: ROUTES.notes() },
];

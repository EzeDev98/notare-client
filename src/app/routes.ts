/**
 * Every path in the app lives here and nowhere else (A-11, S-12). Screens call
 * `ROUTES.x(...)` or receive a destination as a prop; they never hold a path
 * string. An ESLint rule enforces it (step 7a).
 *
 * Two halves:
 *   ROUTES          the target routes from the master doc (5.4).
 *   ROUTES.legacy   paths that old screens still use. Each one is deleted in
 *                   the step that rebuilds or removes its screen.
 *
 * ROUTE_PATTERNS holds the same paths in React Router form (":noteId") for
 * routeConfig.tsx. Builders produce real URLs; patterns never leave the router.
 */

export const NOTES_VIEWS = ['all', 'shared', 'archived', 'deleted'] as const;
export type NotesView = (typeof NOTES_VIEWS)[number];

const enc = encodeURIComponent;

export const ROUTE_PATTERNS = {
  welcome: '/welcome',
  signIn: '/sign-in',
  register: '/register',
  verify: '/verify',
  resetPassword: '/reset',
  onboarding: '/install',
  notes: '/notes',
  note: '/notes/:noteId',
  settings: '/settings',
  settingsAccount: '/settings/account',
  settingsAppearance: '/settings/appearance',
  settingsSync: '/settings/sync',
  settingsDevices: '/settings/devices',
  settingsSecurity: '/settings/security',
  settingsPassword: '/settings/password',
  settingsDeleted: '/settings/deleted',
  settingsAbout: '/settings/about',
  settingsTerms: '/settings/terms',
  settingsPrivacy: '/settings/privacy',
  notFound: '*',

  // Old paths. Redirected for one release once the new screens exist (7a, 18).
  oldSignIn: '/login',
  oldResetPassword: '/reset-password',

  // Old screens, removed as each one is rebuilt (steps 8 to 18).
  legacy: {
    noteNew: '/notes/new',
    noteLocal: '/notes/local/:localId',
    noteShare: '/notes/:noteId/share',
    archived: '/archived',
    search: '/search',
    shared: '/shared',
    sharedNote: '/shared/:noteId',
    collaborations: '/collaborations',
    collaborationsInvite: '/collaborations/invite',
    notifications: '/notifications',
    accountSessions: '/account/sessions',
  },
} as const;

export const ROUTES = {
  welcome: () => '/welcome',
  signIn: () => '/sign-in',
  register: () => '/register',
  verify: () => '/verify',
  resetPassword: () => '/reset',
  onboarding: () => '/install',

  /** The list. "all" has no query string so the bare /notes stays the home URL. */
  notes: (view: NotesView = 'all') => (view === 'all' ? '/notes' : `/notes?view=${view}`),
  /** One note, one route. `id` is the note's id as the caller holds it. */
  note: (id: string | number) => `/notes/${enc(String(id))}`,

  /** A note's path that keeps the list on the view it was opened from. */
  inView: (path: string, view: NotesView) => (view === 'all' ? path : `${path}?view=${view}`),

  settings: () => '/settings',
  settingsAccount: () => '/settings/account',
  settingsAppearance: () => '/settings/appearance',
  settingsSync: () => '/settings/sync',
  settingsDevices: () => '/settings/devices',
  settingsSecurity: () => '/settings/security',
  settingsPassword: () => '/settings/password',
  settingsDeleted: () => '/settings/deleted',
  settingsAbout: () => '/settings/about',
  settingsTerms: () => '/settings/terms',
  settingsPrivacy: () => '/settings/privacy',

  legacy: {
    noteNew: () => '/notes/new',
    noteLocal: (localId: string | number) => `/notes/local/${enc(String(localId))}`,
    noteShare: (id: string | number) => `/notes/${enc(String(id))}/share`,
    /** A note by local id until it has a server id, then by server id. */
    noteOf: (n: { serverId: string | number | null; localId: string | number }) =>
      n.serverId === null
        ? `/notes/local/${enc(String(n.localId))}`
        : `/notes/${enc(String(n.serverId))}`,
    archived: () => '/archived',
    search: (q?: string) => (q ? `/search?q=${enc(q)}` : '/search'),
    shared: () => '/shared',
    sharedNote: (id: string | number) => `/shared/${enc(String(id))}`,
    collaborations: () => '/collaborations',
    collaborationsInvite: () => '/collaborations/invite',
    notifications: () => '/notifications',
    accountSessions: () => '/account/sessions',
  },
} as const;

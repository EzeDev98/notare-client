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
  settingsAppearance: '/settings/appearance',
  settingsSync: '/settings/sync',
  settingsGeneral: '/settings/general',
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
    archived: '/archived',
    search: '/search',
    notifications: '/notifications',
  },
} as const;

export const ROUTES = {
  welcome: () => '/welcome',
  signIn: () => '/sign-in',
  register: () => '/register',
  verify: () => '/verify',
  resetPassword: () => '/reset',
  onboarding: () => '/install',

  /** The list. */
  notes: () => '/notes',
  /** One note, one route. `id` is the note's id as the caller holds it. */
  note: (id: string | number) => `/notes/${enc(String(id))}`,

  settingsAppearance: () => '/settings/appearance',
  settingsSync: () => '/settings/sync',
  settingsGeneral: () => '/settings/general',
  settingsAbout: () => '/settings/about',
  settingsTerms: () => '/settings/terms',
  settingsPrivacy: () => '/settings/privacy',

  legacy: {
    noteNew: () => '/notes/new',
    noteLocal: (localId: string | number) => `/notes/local/${enc(String(localId))}`,
    /** A note by local id until it has a server id, then by server id. */
    noteOf: (n: { serverId: string | number | null; localId: string | number }) =>
      n.serverId === null
        ? `/notes/local/${enc(String(n.localId))}`
        : `/notes/${enc(String(n.serverId))}`,
    archived: () => '/archived',
    search: (q?: string) => (q ? `/search?q=${enc(q)}` : '/search'),
    notifications: () => '/notifications',
  },
} as const;

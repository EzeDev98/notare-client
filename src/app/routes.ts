/** Every path in the app. */
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

  oldSignIn: '/login',
  oldResetPassword: '/reset-password',

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

  notes: () => '/notes',
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
    noteOf: (n: { serverId: string | number | null; localId: string | number }) =>
      n.serverId === null
        ? `/notes/local/${enc(String(n.localId))}`
        : `/notes/${enc(String(n.serverId))}`,
    archived: () => '/archived',
    search: (q?: string) => (q ? `/search?q=${enc(q)}` : '/search'),
    notifications: () => '/notifications',
  },
} as const;

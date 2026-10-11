import { matchPath } from 'react-router';

import { ROUTE_ENTRIES, ROUTE_REDIRECTS } from '@/app/routeConfig';
import { ROUTES } from '@/app/routes';

/**
 * What the app knows at start-up, all of it already read. decideRoute reads
 * nothing itself, so the same input always gives the same answer.
 */
export interface StartupInput {
  /** The address the person opened, split in two. */
  pathname: string;
  search: string;
  /** A signed-in session exists (including one being refreshed). */
  hasSession: boolean;
  /** Running as the installed app. */
  installed: boolean;
  /** Install is required before anything else (O-14). */
  installMandatory: boolean;
  online: boolean;
  /** This device already holds notes. */
  hasLocalData: boolean;
}

/** The one answer start-up acts on. */
export type Decision =
  /** Show the install gate. It leaves the router for step 9. */
  | { kind: 'install' }
  /** First open: no session, no cached notes and no connection (master 6.7). */
  | { kind: 'offline' }
  /** Go here, replacing the address, before the app is shown. */
  | { kind: 'go'; to: string; from?: string }
  /** The address is fine as it is. */
  | { kind: 'stay' };

const go = (to: string, from?: string): Decision =>
  from === undefined ? { kind: 'go', to } : { kind: 'go', to, from };

/**
 * One decision, made once, before the first screen shows (master 5.5), so the
 * person never sees an intermediate redirect.
 *
 * Order matters:
 *   1. Install gate, while install is mandatory and the app is not installed.
 *   2. First open with nothing to show and no connection: the offline screen.
 *   3. The bare address "/" goes to sign in or to the notes list.
 *   4. An old address (/login, /reset-password) goes straight to its new one.
 *   5. A signed-out visitor on a signed-in page goes to sign in, remembering
 *      where they were headed.
 *   6. A signed-in visitor on a signed-out page (sign in, register) goes to the notes.
 *   7. Anything else stays where it is, so deep links keep working.
 *
 * Never opens the editor on its own: starting on the list is what stops the
 * phone keyboard appearing on launch (D-13).
 */
export function decideRoute(input: StartupInput): Decision {
  if (input.installMandatory && !input.installed) return { kind: 'install' };
  if (!input.hasSession && !input.online && !input.hasLocalData) return { kind: 'offline' };

  const { pathname, search, hasSession } = input;
  if (pathname === '/') return go(hasSession ? ROUTES.notes() : ROUTES.welcome());

  const moved = ROUTE_REDIRECTS.find((r) => matchPath({ path: r.from, end: true }, pathname));
  if (moved) return go(moved.to);

  const entry = ROUTE_ENTRIES.find((e) => matchPath({ path: e.path, end: true }, pathname));
  if (entry?.guards.requiresAuth && !hasSession) return go(ROUTES.signIn(), `${pathname}${search}`);
  if (entry?.guards.publicOnly && hasSession) return go(ROUTES.notes());

  return { kind: 'stay' };
}

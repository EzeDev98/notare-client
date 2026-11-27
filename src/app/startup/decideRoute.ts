/** Decides where the app opens. */
import { matchPath } from 'react-router';

import { ROUTE_ENTRIES, ROUTE_REDIRECTS } from '@/app/routeConfig';
import { ROUTES } from '@/app/routes';

export interface StartupInput {
  pathname: string;
  search: string;
  hasSession: boolean;
  installed: boolean;
  installChoice: 'browser' | null;
  online: boolean;
  hasLocalData: boolean;
}

export type Decision =
  | { kind: 'install' }
  | { kind: 'offline' }
  | { kind: 'go'; to: string; from?: string }
  | { kind: 'stay' };

const go = (to: string, from?: string): Decision =>
  from === undefined ? { kind: 'go', to } : { kind: 'go', to, from };

export function decideRoute(input: StartupInput): Decision {
  if (!input.installed && input.installChoice !== 'browser') return { kind: 'install' };
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

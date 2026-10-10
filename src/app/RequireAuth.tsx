import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { RouteFallback } from '@/app/RouteFallback';
import { ROUTES } from '@/app/routes';

/**
 * Gates the authenticated application shell.
 *
 * ONE component, wrapping the layout route — not a check inside each page. A
 * route added under this layout is protected by virtue of where it sits, and
 * cannot be accidentally left public. That is the seam 1E left open.
 */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case 'initializing':
      /*
       * NEITHER the app nor login — this is why `initializing` exists as a
       * distinct state.
       *
       * Redirecting here would flash the login screen on every reload while
       * the stored session is still being read, and worse: the Navigate would
       * fire and replace the intended destination before we knew we had a
       * session at all.
       */
      return <RouteFallback />;

    case 'authenticated':
    case 'refreshing':
      /*
       * `refreshing` renders the app unchanged. A background token refresh
       * must not unmount the editor someone is typing in — which is the whole
       * reason that state carries the user along rather than dropping it.
       */
      return <Outlet />;

    case 'unauthenticated':
    case 'authenticating':
    case 'session-expired': {
      /*
       * Where they were trying to go, so login can send them back.
       *
       * `replace` so the protected URL does not sit in history — without it,
       * Back from the login screen returns to a route that bounces straight
       * here again, and the user is trapped.
       */
      const from = `${location.pathname}${location.search}`;
      return <Navigate to={ROUTES.signIn()} state={{ from }} replace />;
    }

    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

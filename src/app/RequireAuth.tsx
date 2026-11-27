/** Keeps signed-out people out of the signed-in screens. */
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { RouteFallback } from '@/app/RouteFallback';
import { ROUTES } from '@/app/routes';

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'session-expired' && state.user !== null) return <Outlet />;

  switch (state.status) {
    case 'initializing':
      return <RouteFallback />;

    case 'authenticated':
    case 'refreshing':
      return <Outlet />;

    case 'unauthenticated':
    case 'authenticating':
    case 'session-expired': {
      const from = `${location.pathname}${location.search}`;
      return <Navigate to={ROUTES.signIn()} state={{ from }} replace />;
    }

    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

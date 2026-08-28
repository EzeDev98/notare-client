import { RouterProvider } from 'react-router';

import { AuthProvider } from '@/app/providers/AuthProvider';
import { useAuth } from '@/app/providers/auth-context';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { router } from '@/app/router';
import { AppSplash } from '@/pwa/components/AppSplash';
import { InstallBanner } from '@/pwa/components/InstallBanner';
import { UpdateBanner } from '@/pwa/components/UpdateBanner';

/**
 * Step 2d. Gates the rest of the tree behind AuthProvider's own startup
 * restore (see AuthProvider's STARTUP RESTORE effect) - the one piece of
 * boot that is genuinely asynchronous and of unpredictable duration (a
 * network round-trip through ensureFreshAccessToken + getCurrentUser).
 *
 * `state.status === 'initializing'` is read directly, with no timer and
 * no minimum-display duration: AppSplash's own doc comment says it should
 * stay mounted "only as long as boot actually takes", and the instant
 * authReducer leaves `initializing` (INIT_NO_SESSION or INIT_RESTORED) IS
 * the instant boot is over. Anything else would either cut the splash
 * short (before we know if there's a session - a flash of the wrong
 * screen) or hold it open past the point it has anything left to wait
 * for.
 *
 * A child of AuthProvider, not a sibling before it: useAuth() needs the
 * context, and AuthProvider's init effect fires on mount regardless of
 * whether anything below it is reading that state yet - nesting here
 * doesn't delay when the restore starts, only what's shown while it's in
 * flight.
 *
 * QueryProvider/ToastProvider/RouterProvider only mount once boot is
 * over: nothing under the router needs a query client or a toast host
 * while the splash is the only thing on screen. RequireAuth's own
 * `initializing` branch (RouteFallback) was only ever a same-tab
 * fallback for a route change, never the first paint - this is the
 * first paint now, so RouteFallback's job there becomes unreachable on
 * cold start and only fires on an actual in-app navigation edge case
 * going forward.
 *
 * Step 3/4 note: this is deliberately the 'splash' -> 'ready' half only.
 * The 'install' phase (mandatory InstallPage) isn't wired in yet because
 * InstallPage doesn't exist until Step 3 - this function is what Step 4
 * will extend into the full bootPhase state machine once it does.
 */
function AppBoot() {
  const { state } = useAuth();

  if (state.status === 'initializing') {
    return <AppSplash />;
  }

  return (
    <QueryProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryProvider>
  );
}

/**
 * The composition root. Providers wrap RouterProvider and accumulate here as
 * later steps add them - auth, query client, sync.
 *
 * ThemeProvider is outermost: an error boundary rendering inside the router
 * should still be themed.
 *
 * UpdateBanner and InstallBanner both sit OUTSIDE AuthProvider - a new
 * version, or the option to install, is offerable whether or not anyone is
 * signed in (the login screen itself is served by the same service worker).
 * Step 5 retires InstallBanner once InstallPage/bootPhase (Steps 3-4)
 * replace it; until then it renders its own banner independently of
 * AppBoot's splash/ready decision below - UpdateBanner is unaffected and
 * stays permanently.
 *
 * AppBoot (Step 2d) is what actually decides, on every cold start, between
 * AppSplash and the real app - see its own doc comment.
 */
export function App() {
  return (
    <ThemeProvider>
      <InstallBanner />
      <UpdateBanner />
      <AuthProvider>
        <AppBoot />
      </AuthProvider>
    </ThemeProvider>
  );
}

import { RouterProvider } from 'react-router';

import { AuthProvider } from '@/app/providers/AuthProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { router } from '@/app/router';
import { useBootPhase } from '@/app/useBootPhase';
import { AppSplash } from '@/pwa/components/AppSplash';
import { InstallPage } from '@/pwa/components/InstallPage';
import { UpdateAvailableModal } from '@/pwa/components/UpdateAvailableModal';

/**
 * Step 2d/4a-4c. Renders against useBootPhase()'s three-state BootPhase
 * rather than checking AuthProvider's status directly the way this
 * function did before Step 4a — same underlying signal today (see
 * useBootPhase's own doc comment), just switched through the named
 * seam Step 4b/4c built out.
 *
 * A child of AuthProvider, not a sibling before it: useBootPhase()
 * needs useAuth()'s context, and AuthProvider's init effect fires on
 * mount regardless of whether anything below it is reading that state
 * yet — nesting here doesn't delay when the restore starts, only what
 * is shown while it's in flight.
 *
 * QueryProvider/ToastProvider/RouterProvider only mount once boot is
 * over: nothing under the router needs a query client or a toast host
 * while the splash or the mandatory InstallPage is the only thing on
 * screen. RequireAuth's own `initializing` branch (RouteFallback) was
 * only ever a same-tab fallback for a route change, never the first
 * paint — this is the first paint now.
 *
 * 'install' is a real, reachable case as of 4b/4c, not the placeholder
 * it was through 4a: useBootPhase() returns it whenever
 * useIsStandalone() is false, and this now renders the actual
 * InstallPage rather than AppSplash for it — see InstallPage's own doc
 * comments for why it is a hard gate (no skip/dismiss) and how it tells
 * "installed" apart from "prompt dismissed".
 */
function AppBoot() {
  const bootPhase = useBootPhase();

  switch (bootPhase) {
    case 'splash':
      return <AppSplash />;
    case 'install':
      return <InstallPage />;
    case 'ready':
      return (
        <QueryProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryProvider>
      );
  }
}

/**
 * The composition root. Providers wrap RouterProvider and accumulate here as
 * later steps add them - auth, query client, sync.
 *
 * ThemeProvider is outermost: an error boundary rendering inside the router
 * should still be themed.
 *
 * UpdateAvailableModal sits OUTSIDE AuthProvider - a new version is
 * offerable whether or not anyone is signed in (the login screen itself is
 * served by the same service worker).
 *
 * Step 5a/5b. InstallBanner no longer mounts here, and its component/
 * stylesheet (InstallBanner.tsx, InstallBanner.css) are deleted -
 * InstallPage/bootPhase (Steps 3-4) fully replace what it did, and the two
 * together would have meant a person on the 'install' phase could see
 * InstallPage's full-screen gate AND InstallBanner's own "Install Notare"
 * banner over the top of it, both reading the same underlying signal.
 * useInstallPrompt.ts (the hook InstallBanner used) stays - InstallPage
 * itself still calls it.
 *
 * AppBoot (Step 2d/4a) is what actually decides, on every cold start,
 * between AppSplash, InstallPage, and the real app - see its own doc
 * comment.
 */
export function App() {
  return (
    <ThemeProvider>
      <UpdateAvailableModal />
      <AuthProvider>
        <AppBoot />
      </AuthProvider>
    </ThemeProvider>
  );
}

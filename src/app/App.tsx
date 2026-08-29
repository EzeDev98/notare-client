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
 * Step 2d/4a-4c/8c. Renders against useBootPhase()'s phase + splashStage
 * rather than checking AuthProvider's status directly.
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
 * screen.
 *
 * 'install' renders the actual InstallPage — see InstallPage's own doc
 * comments for why it is a hard gate (no skip/dismiss) and how it tells
 * "installed" apart from "prompt dismissed".
 */
function AppBoot() {
  const { phase, splashStage } = useBootPhase();

  switch (phase) {
    case 'splash':
      return <AppSplash stage={splashStage} />;
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
 * AppBoot (Step 2d/4a/8c) is what actually decides, on every cold start,
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

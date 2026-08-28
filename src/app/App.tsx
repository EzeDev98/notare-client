import { RouterProvider } from 'react-router';

import { AuthProvider } from '@/app/providers/AuthProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { router } from '@/app/router';
import { InstallBanner } from '@/pwa/components/InstallBanner';
import { UpdateBanner } from '@/pwa/components/UpdateBanner';

/**
 * The composition root. Providers wrap RouterProvider and accumulate here as
 * later steps add them — auth, query client, sync.
 *
 * ThemeProvider is outermost: an error boundary rendering inside the router
 * should still be themed.
 *
 * QueryProvider sits inside AuthProvider, not outside it: every query this
 * client will ever run (sharing, collaboration, notifications) is scoped to
 * the signed-in user, so the cache should exist only where a user session
 * does. It sits outside ToastProvider so a future global query-error handler
 * can surface a toast, rather than the other way round.
 *
 * UpdateBanner and InstallBanner both sit OUTSIDE AuthProvider — a new
 * version, or the option to install, is offerable whether or not anyone is
 * signed in (the login screen itself is served by the same service worker).
 */
export function App() {
  return (
    <ThemeProvider>
      <InstallBanner />
      <UpdateBanner />
      <AuthProvider>
        <QueryProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

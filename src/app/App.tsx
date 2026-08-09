import { RouterProvider } from 'react-router';

import { AuthProvider } from '@/app/providers/AuthProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { router } from '@/app/router';

/**
 * The composition root. Providers wrap RouterProvider and accumulate here as
 * later steps add them — auth, query client, sync.
 *
 * ThemeProvider is outermost: an error boundary rendering inside the router
 * should still be themed.
 */
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

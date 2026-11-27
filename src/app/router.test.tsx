/** Tests for router. */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/router';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/design-system/ui';
import { SignedIn, resetDatabase } from '~/harness';

const AUTHENTICATED_PATHS: Array<{ path: string; expectedTitle: string }> = [
  { path: '/notes', expectedTitle: 'Notes · Notare' },
  { path: '/notes/new', expectedTitle: 'New note · Notare' },
  { path: '/archived', expectedTitle: 'Notes · Notare' },
  { path: '/search', expectedTitle: 'Notes · Notare' },
  { path: '/notifications', expectedTitle: 'Notes · Notare' },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <SignedIn>
        <QueryProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryProvider>
      </SignedIn>
    </ThemeProvider>,
  );
}

describe('the real route tree', () => {
  it.each(AUTHENTICATED_PATHS)('resolves $path to its own page, not 404', async ({ path, expectedTitle }) => {
    await resetDatabase();
    renderAt(path);

    await waitFor(() => expect(document.title).toBe(expectedTitle));
  });

  it('does not let /notes/new be captured by /notes/:noteId', async () => {
    await resetDatabase();
    renderAt('/notes/new');

    await waitFor(() => expect(document.title).toBe('New note · Notare'));
  });

  it('resolves /notes/local/:localId to its own page, not the 404 route', async () => {
    await resetDatabase();
    renderAt('/notes/local/some-uuid');

    await waitFor(() => expect(document.title).toBe('Note · Notare'));
  });
});

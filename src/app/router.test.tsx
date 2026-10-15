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
  { path: '/archived', expectedTitle: 'Archived · Notare' },
  { path: '/trash', expectedTitle: 'Trash · Notare' },
  { path: '/search', expectedTitle: 'Search · Notare' },
  // '/shared/:noteId', '/notes/:noteId/share' and '/voice/:voiceNoteId' are
  // deliberately absent from this list, same as '/notes/:noteId' already
  // was — all are dynamic routes that need a real id and seeded (or
  // mocked) data to resolve to anything but a not-found state; this list
  // only covers the static paths.
  { path: '/shared', expectedTitle: 'Shared with me · Notare' },
  { path: '/collaborations', expectedTitle: 'Collaborations · Notare' },
  { path: '/collaborations/invite', expectedTitle: 'Find people · Notare' },
  { path: '/notifications', expectedTitle: 'Notifications · Notare' },
  { path: '/voice', expectedTitle: 'Voice notes · Notare' },
  { path: '/account/sessions', expectedTitle: 'Sessions · Notare' },
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

    // No row for 'some-uuid' — the local route's own not-found state sets
    // this exact title. A 404 fallthrough would set 'Page not found · Notare'
    // instead, which is the thing this test actually guards against.
    await waitFor(() => expect(document.title).toBe('Note · Notare'));
  });
});

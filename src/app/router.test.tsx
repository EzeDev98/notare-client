import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/router';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { SignedIn, resetDatabase } from '~/harness';

/**
 * D1, closed. Every page-level test (Trash.test.tsx, Search.test.tsx,
 * createNote.test.tsx, ...) mounts its page in a throwaway memory router,
 * which proves the component renders but says nothing about whether the real
 * app can ever reach it. That gap is exactly how four built pages sat
 * unroutable from Step 5 to Step 7 without a single test failing.
 *
 * This test imports the ACTUAL `routes` array `router.tsx` ships and drives
 * navigation through it, so a path that regresses to 404 fails here.
 */

const AUTHENTICATED_PATHS: Array<{ path: string; expectedTitle: string }> = [
  { path: '/notes', expectedTitle: 'Notes · Notare' },
  { path: '/notes/new', expectedTitle: 'New note · Notare' },
  { path: '/archived', expectedTitle: 'Archived · Notare' },
  { path: '/trash', expectedTitle: 'Trash · Notare' },
  { path: '/search', expectedTitle: 'Search · Notare' },
  { path: '/conflicts', expectedTitle: 'Conflicts · Notare' },
  // '/shared/:noteId' is deliberately absent from this list, same as
  // '/notes/:noteId' already was — both are dynamic routes that need a real
  // id and seeded (or mocked) data to resolve to anything but a not-found
  // state; this list only covers the static paths.
  { path: '/shared', expectedTitle: 'Shared with me · Notare' },
  { path: '/account/sessions', expectedTitle: 'Sessions · Notare' },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <SignedIn>
      <QueryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryProvider>
    </SignedIn>,
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

    // NoteDetail titles a note "Untitled note" when it has no title yet —
    // the exact failure mode this route was captured by before 7D. Asserting
    // the NewNote title, not just "not 404", is what proves the fix.
    await waitFor(() => expect(document.title).toBe('New note · Notare'));
  });
});

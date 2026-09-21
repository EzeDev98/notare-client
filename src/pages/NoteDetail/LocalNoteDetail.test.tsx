import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { LocalNoteDetailPage } from '@/pages/NoteDetail/LocalNoteDetail';
import { expectNoAxeViolations } from '~/a11y';
import { makeRow } from '~/fixtures/notes';
import { resetDatabase, seedNotes, SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderLocal(path = '/notes/local/local-abc') {
  const router = createMemoryRouter(
    [
      { path: '/notes/local/:localId', element: <LocalNoteDetailPage /> },
      { path: '/notes', element: <h1>All notes</h1> },
    ],
    { initialEntries: [path] },
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <SignedIn>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SignedIn>
    </QueryClientProvider>,
  );
}

describe('the local note detail view', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('has no automatically detectable accessibility violations', async () => {
    await seedNotes(
      makeRow({ localId: 'local-abc', serverId: null, clientId: 'local-abc', content: 'Draft' }),
    );

    const { container } = renderLocal();
    await screen.findByDisplayValue('Draft');
    await expectNoAxeViolations(container);
  });

  // The whole point of this route: a note with no serverId yet must still
  // open, reading Dexie directly rather than asking the server about it.
  it('loads a note by localId from Dexie, with no server request', async () => {
    let requested = false;
    server.use(
      http.get(`${BASE}/notes/:noteId`, () => {
        requested = true;
        return HttpResponse.json(null);
      }),
    );

    await seedNotes(
      makeRow({
        localId: 'local-abc',
        serverId: null,
        clientId: 'local-abc',
        content: 'Written offline',
      }),
    );

    renderLocal();

    expect(await screen.findByDisplayValue('Written offline')).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  // useNote(serverId) would coerce a UUID through Number(...) and end up
  // fetching /notes/NaN, or worse, some unrelated numeric-looking id. This
  // route must never do that — it never turns localId into a serverId at
  // all.
  it('does not treat the localId as a numeric serverId', async () => {
    let requestedPath: string | null = null;
    server.use(
      http.get(`${BASE}/notes/:noteId`, ({ params }) => {
        requestedPath = String(params.noteId);
        return HttpResponse.json(null);
      }),
    );

    await seedNotes(
      makeRow({ localId: '9f2c-uuid-like', serverId: null, clientId: '9f2c-uuid-like' }),
    );

    renderLocal('/notes/local/9f2c-uuid-like');

    await screen.findByLabelText('Note content');
    expect(requestedPath).toBeNull();
  });

  it('renders the same editor used for server-backed notes', async () => {
    await seedNotes(
      makeRow({
        localId: 'local-abc',
        serverId: null,
        clientId: 'local-abc',
        content: 'still unsynced',
      }),
    );

    renderLocal();

    expect(await screen.findByLabelText('Note content')).toHaveValue('still unsynced');
  });

  it('shows a not-found state for a localId with no matching row', async () => {
    renderLocal('/notes/local/does-not-exist');

    expect(await screen.findByRole('heading', { name: /note not found/i })).toBeInTheDocument();
  });
});

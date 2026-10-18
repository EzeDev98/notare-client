import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/design-system/ui';
import { outboxRepository } from '@/features/notes/local/noteRepository';
import { NewNotePage } from '@/pages/NewNote/NewNote';
import { LocalNoteDetailPage } from '@/pages/NoteDetail/LocalNoteDetail';
import { makeNote } from '~/fixtures/notes';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderNew() {
  const router = createMemoryRouter(
    [
      { path: '/notes/new', element: <NewNotePage /> },
      { path: '/notes/local/:localId', element: <LocalNoteDetailPage /> },
    ],
    {
      initialEntries: ['/notes/new'],
    },
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

describe('creating a note', () => {
  it('creates nothing until something is typed', async () => {
    let creates = 0;
    server.use(
      http.post(`${BASE}/notes`, () => {
        creates += 1;
        return HttpResponse.json(makeNote({ id: 42 }), { status: 201 });
      }),
    );

    renderNew();
    await screen.findByLabelText('Note content');
    await new Promise((resolve) => setTimeout(resolve, 1_500));

    // Clicking "New note" and changing your mind leaves no trace.
    expect(creates).toBe(0);
  });

  it('keeps everything typed in one queued CREATE rather than queuing a second note', async () => {
    /*
     * Creation is local-first: the note exists on this device at once and a single CREATE
     * waits in the outbox. Later edits fold into that same row (the same coalescing the
     * offline UPDATE test covers), so the sync engine sends ONE note, not two, each
     * holding half of what the user wrote.
     */
    const user = userEvent.setup();
    renderNew();

    const content = await screen.findByLabelText('Note content');
    await user.click(content);
    await user.paste('first');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(
      async () => {
        const outbox = await outboxRepository.list();
        expect(outbox).toHaveLength(1);
        expect(outbox[0]).toMatchObject({ type: 'CREATE', noteId: null });
        expect(outbox[0]?.content).toContain('first');
      },
      { timeout: 4_000 },
    );
    const [queued] = await outboxRepository.list();

    await user.paste(' and more');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(
      async () => {
        const outbox = await outboxRepository.list();
        expect(outbox).toHaveLength(1);
        expect(outbox[0]?.id).toBe(queued?.id);
        expect(outbox[0]?.content).toContain('and more');
      },
      { timeout: 4_000 },
    );
  }, 15_000);

  it('queues a CREATE when the connection is genuinely gone (8B)', async () => {
    server.use(http.post(`${BASE}/notes`, () => HttpResponse.error()));

    const user = userEvent.setup();
    renderNew();

    const content = await screen.findByLabelText('Note content');
    await user.click(content);
    await user.paste('written with no connection');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(
      async () => {
        const outbox = await outboxRepository.list();
        expect(outbox).toHaveLength(1);
        expect(outbox[0]).toMatchObject({ type: 'CREATE', noteId: null });
        expect(outbox[0]?.content).toContain('written with no connection');
      },
      { timeout: 4_000 },
    );
  }, 10_000);
});

import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { outboxRepository } from '@/features/notes/local/noteRepository';
import { NoteDetailPage } from '@/pages/NoteDetail/NoteDetail';
import { makeNote } from '~/fixtures/notes';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderEditor(path = '/notes/1') {
  const router = createMemoryRouter(
    [
      { path: '/notes/:noteId', element: <NoteDetailPage /> },
      { path: '/notes', element: <h1>All notes</h1> },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

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

/**
 * A DEDICATED file for the offline-UPDATE half of 8B, kept separate from
 * editorRaces.test.tsx / conflict.test.tsx / keepBoth.test.tsx on purpose —
 * those three have pre-existing timing-sensitive failures unrelated to 8B,
 * and this test has no reason to share a file with that flakiness.
 */
describe('editing an existing note with no connection (8B)', () => {
  it('queues an UPDATE carrying the note\u2019s current version', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: '', version: 4 })),
      ),
      http.patch(`${BASE}/notes/:noteId`, () => HttpResponse.error()),
    );

    const user = userEvent.setup();
    renderEditor();

    const content = await screen.findByLabelText('Note content');
    await user.click(content);
    await user.paste('edited with no connection');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(
      async () => {
        const outbox = await outboxRepository.list();
        expect(outbox).toHaveLength(1);
        expect(outbox[0]).toMatchObject({ type: 'UPDATE', noteId: 1 });
        expect(outbox[0]?.content).toContain('edited with no connection');
      },
      { timeout: 4_000 },
    );
  }, 10_000);

  it('coalesces further offline edits into the same queued row rather than appending', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: '', version: 4 })),
      ),
      http.patch(`${BASE}/notes/:noteId`, () => HttpResponse.error()),
    );

    const user = userEvent.setup();
    renderEditor();

    const content = await screen.findByLabelText('Note content');
    await user.click(content);
    await user.paste('first offline edit');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(
      async () => {
        await expect(outboxRepository.list()).resolves.toHaveLength(1);
      },
      { timeout: 4_000 },
    );
    const [queuedAfterFirst] = await outboxRepository.list();

    await user.paste(' and a second offline edit');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(
      async () => {
        const outbox = await outboxRepository.list();
        expect(outbox).toHaveLength(1);
        expect(outbox[0]?.content).toContain('and a second offline edit');
        expect(outbox[0]?.id).toBe(queuedAfterFirst?.id);
      },
      { timeout: 4_000 },
    );
  }, 10_000);
});

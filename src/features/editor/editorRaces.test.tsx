/** Tests for editorRaces. */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/design-system/ui';
import { outboxRepository } from '@/features/notes/local/noteRepository';
import { NoteDetailPage } from '@/pages/NoteDetail/NoteDetail';
import { makeNote } from '~/fixtures/notes';
import { pushOutbox } from '@/sync/push';
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

const serverNote = http.get(`${BASE}/notes/:noteId`, () =>
  HttpResponse.json(makeNote({ id: 1, content: '', version: 0 })),
);

function batchHandler(onOperation: (content: string | undefined) => Promise<void> | void) {
  return http.post(`${BASE}/sync/batch`, async ({ request }) => {
    const body = (await request.json()) as {
      operations: { operationId: string; content?: string }[];
    };
    const operation = body.operations[0];
    await onOperation(operation?.content);
    return HttpResponse.json({
      results: [
        {
          operationId: operation?.operationId,
          status: 'APPLIED',
          note: makeNote({ id: 1, content: operation?.content ?? '', version: 1 }),
        },
      ],
      appliedCount: 1,
      conflictCount: 0,
      serverTime: '2026-08-13T09:00:00.000',
    });
  });
}

async function typeAndQueue(text: string): Promise<void> {
  const user = userEvent.setup();
  renderEditor();

  const content = await screen.findByLabelText('Note content');
  await user.click(content);
  await user.paste(text);
  await user.keyboard('{Control>}s{/Control}');

  await waitFor(
    async () => {
      await expect(outboxRepository.list()).resolves.toHaveLength(1);
    },
    { timeout: 4_000 },
  );
}

describe('one request at a time', () => {
  it('never has two pushes outstanding, however many triggers ask at once', async () => {
    let outstanding = 0;
    let maxOutstanding = 0;
    let batches = 0;

    server.use(
      serverNote,
      batchHandler(async () => {
        outstanding += 1;
        maxOutstanding = Math.max(maxOutstanding, outstanding);
        batches += 1;
        await new Promise((resolve) => setTimeout(resolve, 120));
        outstanding -= 1;
      }),
    );

    await typeAndQueue('the quick brown fox');

    await Promise.all([pushOutbox(), pushOutbox(), pushOutbox()]);

    expect(batches).toBe(1);
    expect(maxOutstanding).toBe(1);
  }, 15_000);

  it('ends with the server holding what is on screen', async () => {
    let lastSaved = '';

    server.use(
      serverNote,
      batchHandler((content) => {
        if (content !== undefined) lastSaved = content;
      }),
    );

    await typeAndQueue('hello world');
    await pushOutbox();

    expect(lastSaved).toBe('hello world');
    await expect(outboxRepository.count()).resolves.toBe(0);
  }, 15_000);
});

describe('switching notes', () => {
  it('does not carry one note draft into another', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, ({ params }) =>
        HttpResponse.json(
          makeNote({
            id: Number(params['noteId']),
            content: `Body ${String(params['noteId'])}`,
          }),
        ),
      ),
    );

    const { unmount } = renderEditor('/notes/5');
    expect(await screen.findByLabelText('Note content')).toHaveTextContent('Body 5');
    unmount();

    renderEditor('/notes/9');

    expect(await screen.findByLabelText('Note content')).toHaveTextContent('Body 9');
  });
});

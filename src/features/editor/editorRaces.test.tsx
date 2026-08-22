import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
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

describe('one request at a time', () => {
  it('never has two saves outstanding, however fast the user types', async () => {
    let outstanding = 0;
    let maxOutstanding = 0;
    let saves = 0;

    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: '', version: 0 })),
      ),
      http.patch(`${BASE}/notes/:noteId`, async ({ request }) => {
        outstanding += 1;
        maxOutstanding = Math.max(maxOutstanding, outstanding);
        saves += 1;

        const body = (await request.json()) as { content?: string; version: number };
        // A slow server, so overlapping requests would be easy if they existed.
        await new Promise((resolve) => setTimeout(resolve, 120));
        outstanding -= 1;

        return HttpResponse.json(
          makeNote({ id: 1, content: body.content ?? '', version: body.version + 1 }),
        );
      }),
    );

    const user = userEvent.setup();
    renderEditor();

    const content = await screen.findByLabelText('Note content');
    await user.type(content, 'the quick brown fox');

    await waitFor(
      () => {
        expect(saves).toBeGreaterThan(0);
      },
      { timeout: 4_000 },
    );

    await new Promise((resolve) => setTimeout(resolve, 2_000));

    /*
     * ONE AT A TIME IS THE ORDERING GUARANTEE.
     *
     * With a single request outstanding there is no "response 2 arrives before
     * response 1" — request 2 does not exist until request 1 has returned. The
     * sequencing everyone reaches for is unnecessary if you simply never
     * create the race.
     */
    expect(maxOutstanding).toBe(1);
  }, 15_000);

  it('ends with the server holding what is on screen', async () => {
    let lastSaved = '';

    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: '', version: 0 })),
      ),
      http.patch(`${BASE}/notes/:noteId`, async ({ request }) => {
        const body = (await request.json()) as { content?: string; version: number };
        await new Promise((resolve) => setTimeout(resolve, 80));
        if (body.content !== undefined) lastSaved = body.content;
        return HttpResponse.json(
          makeNote({ id: 1, content: body.content ?? '', version: body.version + 1 }),
        );
      }),
    );

    const user = userEvent.setup();
    renderEditor();

    const content = await screen.findByLabelText('Note content');
    await user.type(content, 'hello world');

    /*
     * The FOLLOW-UP doing its job. The first request carried the text as it
     * was when it started; without a follow-up the server stays behind
     * forever while the indicator honestly reports unsaved changes.
     */
    await waitFor(
      () => {
        expect(lastSaved).toBe('hello world');
      },
      { timeout: 6_000 },
    );
  }, 15_000);
});

/*
 * TODO (6F): "creates exactly one note, then patches it with everything typed
 * since".
 *
 * The intricate path, where every mechanism in Step 6 participates:
 *
 *   POST in flight, no id yet  -> more edits arrive
 *   single-flight guard        -> no second POST (which would be a SECOND NOTE)
 *   supersededByEdits          -> success does not report "Saved"
 *   version adoption           -> the follow-up PATCH has a version to send
 *   follow-up                  -> the rest of the text reaches the server
 *
 * Not written yet because creation runs through /notes/new, which 6F adds. A
 * stub asserting nothing would be worse than its absence: green, looking like
 * coverage, and still green the day creation breaks.
 */

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
    expect(await screen.findByLabelText('Note content')).toHaveValue('Body 5');
    unmount();

    renderEditor('/notes/9');

    /*
     * useNoteEditor seeds useState from `note`, and useState IGNORES later
     * values — so without the key on NoteEditorHost the draft would still hold
     * note 5's text and version while pointing at note 9's id, and the next
     * auto-save would write one note's content into the other.
     */
    expect(await screen.findByLabelText('Note content')).toHaveValue('Body 9');
  });
});

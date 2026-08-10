import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { NewNotePage } from '@/pages/NewNote/NewNote';
import { makeNote } from '~/fixtures/notes';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderNew() {
  const router = createMemoryRouter([{ path: '/notes/new', element: <NewNotePage /> }], {
    initialEntries: ['/notes/new'],
  });
  return render(
    <SignedIn>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SignedIn>,
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

  it('creates exactly one note, then patches it with everything typed since', async () => {
    /*
     * THE INTRICATE PATH — every mechanism in Step 6 participates:
     *
     *   POST in flight, no id yet   -> more edits arrive
     *   single-flight guard         -> no second POST (which would be a
     *                                  SECOND NOTE holding half the words)
     *   supersededByEdits           -> success does not report "Saved"
     *   version adoption            -> the follow-up PATCH has a version
     *   follow-up                   -> the rest reaches the server
     */
    let creates = 0;
    let lastPatched: string | null = null;

    server.use(
      http.post(`${BASE}/notes`, async ({ request }) => {
        creates += 1;
        const body = (await request.json()) as { content?: string };
        // Slow, so edits definitely arrive while it is outstanding.
        await new Promise((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json(makeNote({ id: 42, content: body.content ?? '', version: 0 }), {
          status: 201,
        });
      }),
      http.patch(`${BASE}/notes/:noteId`, async ({ request }) => {
        const body = (await request.json()) as { content?: string; version: number };
        if (body.content !== undefined) lastPatched = body.content;
        return HttpResponse.json(
          makeNote({ id: 42, content: body.content ?? '', version: body.version + 1 }),
        );
      }),
    );

    const user = userEvent.setup();
    renderNew();

    const content = await screen.findByLabelText('Note content');
    await user.click(content);
    await user.paste('first');

    await waitFor(
      () => {
        expect(creates).toBe(1);
      },
      { timeout: 4_000 },
    );

    // More text while the POST is in flight and after it returns.
    await user.paste(' and more');

    await waitFor(
      () => {
        expect(lastPatched).toContain('and more');
      },
      { timeout: 6_000 },
    );

    // ONE note, not two. A second POST would leave the user with two notes,
    // each holding half of what they wrote.
    expect(creates).toBe(1);
  }, 20_000);
});

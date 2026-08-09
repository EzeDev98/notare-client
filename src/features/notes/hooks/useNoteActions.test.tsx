import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { NotesPage } from '@/pages/Notes/Notes';
import { makeNote, makeNoteSummary, makePage } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderNotes() {
  const router = createMemoryRouter([{ path: '/notes', element: <NotesPage /> }], {
    initialEntries: ['/notes'],
  });
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('pinning', () => {
  it('flips immediately and adopts the version the server returns', async () => {
    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json(makePage([makeNoteSummary({ id: 1, version: 3, pinned: false })])),
      ),
      http.post(`${BASE}/notes/:noteId/pin`, () =>
        // The server bumps @Version on a pin (B5).
        HttpResponse.json(makeNote({ id: 1, pinned: true, version: 4 })),
      ),
    );

    const user = userEvent.setup();
    renderNotes();

    await user.click(await screen.findByRole('button', { name: /^pin note 1$/i }));

    /*
     * The button flips to "Unpin", which is the visible half. The invisible
     * half is the version: the row now holds 4, not 3.
     *
     * Without that, opening this note and saving would send version 3 and get
     * a 409 for an edit in conflict with nothing — the exact failure B5's
     * "every note response must update the stored version" warns about.
     */
    expect(await screen.findByRole('button', { name: /^unpin note 1$/i })).toBeInTheDocument();
  });

  it('reverts when the server refuses', async () => {
    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json(makePage([makeNoteSummary({ id: 1, pinned: false })])),
      ),
      http.post(`${BASE}/notes/:noteId/pin`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderNotes();

    await user.click(await screen.findByRole('button', { name: /^pin note 1$/i }));

    // Optimism has to be reversible, or the UI quietly disagrees with the
    // server until the next reload.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^pin note 1$/i })).toBeInTheDocument();
    });
  });
});

describe('archiving', () => {
  it('removes the note from the list and offers an undo', async () => {
    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json(makePage([makeNoteSummary({ id: 1 }), makeNoteSummary({ id: 2 })])),
      ),
      http.post(`${BASE}/notes/:noteId/archive`, () => HttpResponse.json(makeNote({ id: 1 }))),
    );

    const user = userEvent.setup();
    renderNotes();

    await user.click(await screen.findByRole('button', { name: /^archive note 1$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /note 1/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('button', { name: /undo/i })).toBeInTheDocument();
  });
});

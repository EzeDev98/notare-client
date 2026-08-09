import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { NotesPage } from '@/pages/Notes/Notes';
import { makeNoteSummary, makePage } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderNotes() {
  server.use(
    http.get(`${BASE}/notes`, () =>
      HttpResponse.json(makePage([makeNoteSummary({ id: 1 }), makeNoteSummary({ id: 2 })])),
    ),
  );

  const router = createMemoryRouter([{ path: '/notes', element: <NotesPage /> }], {
    initialEntries: ['/notes'],
  });

  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('deleting a note', () => {
  it('removes the row immediately and offers an undo', async () => {
    const user = userEvent.setup();
    renderNotes();

    await screen.findByRole('link', { name: /note 1/i });
    await user.click(screen.getByRole('button', { name: /move note 1 to trash/i }));

    // Optimistic: gone before the server confirms, because waiting for a round
    // trip makes a delete feel broken on a slow connection.
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /note 1/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('puts the note back at its original position on undo', async () => {
    const user = userEvent.setup();
    renderNotes();

    await screen.findByRole('link', { name: /note 1/i });
    await user.click(screen.getByRole('button', { name: /move note 1 to trash/i }));
    await user.click(await screen.findByRole('button', { name: /undo/i }));

    /*
     * FIRST, not appended at the end. Reinserting elsewhere would silently
     * reorder the user's list as a side effect of an action they cancelled.
     */
    /*
     * Scoped to the LIST, not the whole page. Querying every link made this
     * break when 5E added a "Search" link to the header — the assertion was
     * about ordering within the list and happened to be phrased as ordering
     * within the document.
     */
    const list = await screen.findByRole('list');
    const links = within(list).getAllByRole('link');
    expect(links[0]).toHaveAccessibleName(/note 1/i);
  });

  it('restores the row when the delete fails', async () => {
    server.use(http.delete(`${BASE}/notes/:noteId`, () => new HttpResponse(null, { status: 500 })));

    const user = userEvent.setup();
    renderNotes();

    await screen.findByRole('link', { name: /note 1/i });
    await user.click(screen.getByRole('button', { name: /move note 1 to trash/i }));

    // Optimism has to be reversible, or a failed request silently loses a row
    // until the next reload.
    expect(await screen.findByRole('link', { name: /note 1/i })).toBeInTheDocument();
  });

  it('names the note in the delete button, not just "Delete"', async () => {
    renderNotes();
    await screen.findByRole('link', { name: /note 1/i });

    // Twenty buttons all announcing "Delete" is useless when navigating by
    // button — the same word twenty times with no way to tell them apart.
    expect(screen.getByRole('button', { name: /move note 2 to trash/i })).toBeInTheDocument();
  });
});

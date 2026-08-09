import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { TrashPage } from '@/pages/Trash/Trash';
import { makeNoteSummary, makePage } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderTrash() {
  const router = createMemoryRouter([{ path: '/trash', element: <TrashPage /> }], {
    initialEntries: ['/trash'],
  });
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('the trash', () => {
  it('lists trashed notes without promising they expire', async () => {
    renderTrash();

    await screen.findByRole('heading', { name: /trash/i });

    /*
     * Nothing on the server purges trashed notes — SyncRetentionJob sweeps the
     * sync tables only. A "deleted in 30 days" countdown would be a lie the
     * user acts on by not restoring something.
     */
    expect(screen.getByText(/until you delete them permanently/i)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ days/i)).not.toBeInTheDocument();
  });

  it('requires a second click before deleting forever', async () => {
    let deleted = false;
    server.use(
      http.get(`${BASE}/notes/trash`, () =>
        HttpResponse.json(
          makePage([{ note: makeNoteSummary({ id: 9 }), deletedAt: '2026-08-05T14:00:00.000' }]),
        ),
      ),
      http.delete(`${BASE}/notes/:noteId/permanent`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /permanently delete note 9/i }));
    expect(deleted).toBe(false);

    // The wording IS the confirmation — "Confirm" would be ambiguous for
    // something irreversible.
    await user.click(screen.getByRole('button', { name: /delete forever/i }));
    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });

  it('restores a note back to the notes list', async () => {
    server.use(
      http.get(`${BASE}/notes/trash`, () =>
        HttpResponse.json(
          makePage([{ note: makeNoteSummary({ id: 9 }), deletedAt: '2026-08-05T14:00:00.000' }]),
        ),
      ),
    );

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /restore note 9/i }));

    expect(await screen.findByText(/note restored/i)).toBeInTheDocument();
  });
});

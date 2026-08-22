import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { TrashPage } from '@/pages/Trash/Trash';
import { makeNoteSummary, makePage, makeRow } from '~/fixtures/notes';
import { SignedIn, seedNotes } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderTrash() {
  const router = createMemoryRouter([{ path: '/trash', element: <TrashPage /> }], {
    initialEntries: ['/trash'],
  });
  return render(
    <SignedIn>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SignedIn>,
  );
}

describe('the trash', () => {
  it('lists locally trashed notes without promising they expire', async () => {
    // serverId 91, not 9: the default handler's trash page holds note 9, and a
    // clean row would be overwritten by it mid-test.
    await seedNotes(makeRow({ serverId: 91, content: 'Old draft', deleted: 1 }));

    renderTrash();

    expect(await screen.findByText('Old draft')).toBeInTheDocument();

    /*
     * Nothing on the server purges trashed notes — SyncRetentionJob sweeps the
     * sync tables only. A "deleted in 30 days" countdown would be a lie the
     * user acts on by not restoring something.
     */
    expect(screen.getByText(/until you delete them permanently/i)).toBeInTheDocument();
    expect(screen.queryByText(/deleted in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bin \d+ days?\b/i)).not.toBeInTheDocument();
  });

  it('shows a note trashed offline, which a server-only trash could not', async () => {
    /*
     * The defect 7E closes. Before this the bin was a GET: a note deleted with
     * no connection was gone from the notes list AND absent from the trash, so
     * there was nowhere to undo it from.
     */
    server.use(http.get(`${BASE}/notes/trash`, () => HttpResponse.error()));

    await seedNotes(makeRow({ serverId: null, content: 'Written on a plane', deleted: 1, dirty: 1 }));

    renderTrash();

    expect(await screen.findByText('Written on a plane')).toBeInTheDocument();
    // The failure is a banner beside the notes, not instead of them.
    expect(await screen.findByText(/showing what is in your trash on this device/i)).toBeVisible();
  });

  it('writes the server trash into local storage, scoped to the owner', async () => {
    /*
     * Guards the ownerId regression fixed in 7E: a summary carries no ownerId,
     * so a row inserted on an empty device used to get null and could never
     * match the [ownerId+deleted+archived] query. The fetch succeeded and the
     * screen stayed empty.
     */
    server.use(
      http.get(`${BASE}/notes/trash`, () =>
        HttpResponse.json(
          makePage([
            {
              note: makeNoteSummary({ id: 21, contentPreview: 'From the server' }),
              deletedAt: '2026-08-05T14:00:00.000',
            },
          ]),
        ),
      ),
    );

    renderTrash();

    // Waits on the row landing in Dexie directly, rather than on rendered
    // text: a brand-new row synced from a trash SUMMARY has no local
    // `content` yet (fromNoteSummary only ever backfills from `existing`,
    // never from `contentPreview` — a separate, pre-existing gap outside
    // title removal's scope), so there is no label text here to assert on.
    const stored = await waitFor(async () => {
      const row = await noteRepository.getByServerId(21);
      if (!row) throw new Error('row not synced yet');
      return row;
    });
    expect(stored.ownerId).toBe(1);
    expect(stored.deleted).toBe(1);
    expect(stored.deletedAt).toBe('2026-08-05T14:00:00.000');
  });

  it('requires a second click before deleting forever', async () => {
    let deleted = false;
    server.use(
      http.delete(`${BASE}/notes/:noteId/permanent`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await seedNotes(makeRow({ serverId: 9, content: 'Note 9', deleted: 1 }));

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

    // hardDelete, not a flag: the server has forgotten this note, so a local
    // row could never be reconciled with anything.
    await waitFor(async () => {
      expect(await noteRepository.getByServerId(9)).toBeUndefined();
    });
  });

  it('keeps the note when a permanent delete fails, because there is no undo', async () => {
    server.use(http.delete(`${BASE}/notes/:noteId/permanent`, () => HttpResponse.error()));

    await seedNotes(makeRow({ serverId: 9, content: 'Note 9', deleted: 1 }));

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /permanently delete note 9/i }));
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    expect(await screen.findByText(/you need a connection/i)).toBeInTheDocument();
    // Still there. A local-first delete would have removed it here and left the
    // note alive on every other device.
    expect(await noteRepository.getByServerId(9)).toBeDefined();
  });

  it('restores locally first, so it works with no connection', async () => {
    server.use(http.post(`${BASE}/notes/:noteId/restore`, () => HttpResponse.error()));

    const row = makeRow({ serverId: 9, content: 'Note 9', deleted: 1 });
    await seedNotes(row);

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /restore note 9/i }));

    expect(await screen.findByText(/note restored/i)).toBeInTheDocument();

    await waitFor(async () => {
      const stored = await noteRepository.getByLocalId(row.localId);
      expect(stored?.deleted).toBe(0);
      // Unsent, not lost — but NOT via Step 8's outbox (ADR-006): restore is
      // excluded from it by the server's own contract. 8F's reconnect retry
      // is what eventually calls restoreNote again, not a batch push.
      expect(stored?.dirty).toBe(1);
    });
  });

  it('cancels a queued DELETE when a note is restored before that delete ever reached the server (8B)', async () => {
    server.use(http.post(`${BASE}/notes/:noteId/restore`, () => HttpResponse.error()));

    const row = makeRow({ serverId: 9, content: 'Note 9', deleted: 1 });
    await seedNotes(row);
    await outboxRepository.enqueueDelete({ localId: row.localId, noteId: 9 });

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /restore note 9/i }));

    await waitFor(async () => {
      await expect(outboxRepository.listForNote(row.localId)).resolves.toEqual([]);
    });
  });

  it('adopts the version the server returns on a successful restore', async () => {
    const row = makeRow({ serverId: 9, content: 'Note 9', deleted: 1, version: 3 });
    await seedNotes(row);

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /restore note 9/i }));

    await waitFor(async () => {
      const stored = await noteRepository.getByLocalId(row.localId);
      expect(stored?.dirty).toBe(0);
      expect(stored?.syncState).toBe('synced');
    });
  });
});

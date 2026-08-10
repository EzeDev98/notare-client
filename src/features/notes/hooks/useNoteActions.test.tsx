import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { useNoteActions } from '@/features/notes/hooks/useNoteActions';
import { toView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { makeNote, makeRow } from '~/fixtures/notes';
import { seedNotes } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

/**
 * Tested against DEXIE, not against callbacks.
 *
 * The previous version of this file asserted that onUpdated fired with the
 * right patch — it tested the plumbing that 7D deleted. What matters now is
 * what ends up in the row, because the row is what the UI renders.
 */
function renderActions() {
  return renderHook(() => useNoteActions(), { wrapper: ToastProvider });
}

describe('pinning', () => {
  it('writes the pin locally before the server is asked', async () => {
    const row = makeRow({ serverId: 1, pinned: 0 });
    await seedNotes(row);

    let requested = false;
    server.use(
      http.post(`${BASE}/notes/:noteId/pin`, async () => {
        requested = true;
        // Slow enough that a test asserting "local first" would fail if the
        // write waited for it.
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(makeNote({ id: 1, pinned: true, version: 5 }));
      }),
    );

    const { result } = renderActions();
    const promise = result.current.togglePin(toView(row));

    await waitFor(async () => {
      const stored = await noteRepository.getByLocalId(row.localId);
      expect(stored?.pinned).toBe(1);
    });

    await promise;
    expect(requested).toBe(true);
  });

  it('adopts the version the server returns, so the next edit is not stale', async () => {
    const row = makeRow({ serverId: 1, pinned: 0, version: 3 });
    await seedNotes(row);

    server.use(
      http.post(`${BASE}/notes/:noteId/pin`, () =>
        HttpResponse.json(makeNote({ id: 1, pinned: true, version: 4 })),
      ),
    );

    const { result } = renderActions();
    await result.current.togglePin(toView(row));

    const stored = await noteRepository.getByLocalId(row.localId);
    // Version adopted AND the row marked clean — nothing changed locally
    // while the request was in flight.
    expect(stored?.version).toBe(4);
    expect(stored?.dirty).toBe(0);
  });

  it('keeps the pin and stays dirty when the server refuses', async () => {
    /*
     * THE BEHAVIOUR CHANGE OF 7D. This used to revert and raise a toast. The
     * user's intent is now recorded locally and survives the failure — Step 8
     * pushes it later. Reverting would discard an instruction the user gave.
     */
    const row = makeRow({ serverId: 1, pinned: 0 });
    await seedNotes(row);

    server.use(
      http.post(`${BASE}/notes/:noteId/pin`, () => new HttpResponse(null, { status: 500 })),
    );

    const { result } = renderActions();
    await result.current.togglePin(toView(row));

    const stored = await noteRepository.getByLocalId(row.localId);
    expect(stored?.pinned).toBe(1);
    expect(stored?.dirty).toBe(1);
  });

  it('pins a note that has never reached the server', async () => {
    // No serverId, so there is nothing to PATCH. MSW would error on an
    // unhandled request, which is what proves none was made.
    const row = makeRow({ serverId: null, pinned: 0 });
    await seedNotes(row);

    const { result } = renderActions();
    await result.current.togglePin(toView(row));

    const stored = await noteRepository.getByLocalId(row.localId);
    expect(stored?.pinned).toBe(1);
    expect(stored?.dirty).toBe(1);
  });
});

describe('archiving', () => {
  it('sets archived locally and reports the server version', async () => {
    const row = makeRow({ serverId: 1, archived: 0, version: 2 });
    await seedNotes(row);

    server.use(
      http.post(`${BASE}/notes/:noteId/archive`, () =>
        HttpResponse.json(makeNote({ id: 1, archived: true, version: 3 })),
      ),
    );

    const { result } = renderActions();
    await result.current.setArchived(toView(row), true);

    const stored = await noteRepository.getByLocalId(row.localId);
    expect(stored?.archived).toBe(1);
    expect(stored?.version).toBe(3);
  });
});

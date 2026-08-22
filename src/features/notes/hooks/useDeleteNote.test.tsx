import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { toView } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { makeRow } from '~/fixtures/notes';
import { seedNotes } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderDelete() {
  return renderHook(() => useDeleteNote(), { wrapper: ToastProvider });
}

describe('deleting a note', () => {
  it('marks the row deleted so every live query drops it', async () => {
    const row = makeRow({ serverId: 1 });
    await seedNotes(row);

    server.use(http.delete(`${BASE}/notes/:noteId`, () => new HttpResponse(null, { status: 204 })));

    const { result } = renderDelete();
    await result.current(toView(row));

    const stored = await noteRepository.getByLocalId(row.localId);
    // Soft, not hard. The row survives so the trash can list it and an undo
    // is a local write rather than a re-fetch.
    expect(stored?.deleted).toBe(1);
    expect(stored).toBeDefined();
  });

  it('keeps the note in the local trash when the request fails', async () => {
    const row = makeRow({ serverId: 1 });
    await seedNotes(row);

    server.use(http.delete(`${BASE}/notes/:noteId`, () => new HttpResponse(null, { status: 500 })));

    const { result } = renderDelete();
    await result.current(toView(row));

    const stored = await noteRepository.getByLocalId(row.localId);
    // The user's action stands. It is unsynced, not undone.
    expect(stored?.deleted).toBe(1);
    expect(stored?.dirty).toBe(1);
  });

  it('deletes a note the server has never seen without calling it', async () => {
    const row = makeRow({ serverId: null });
    await seedNotes(row);

    const { result } = renderDelete();
    await result.current(toView(row));

    const stored = await noteRepository.getByLocalId(row.localId);
    expect(stored?.deleted).toBe(1);
  });

  it('leaves the row in place for the trash to list', async () => {
    const row = makeRow({ serverId: null, localUpdatedAt: 1_000 });
    await seedNotes(row);

    const { result } = renderDelete();
    await result.current(toView(row));

    const stored = await noteRepository.getByLocalId(row.localId);
    expect(stored?.deleted).toBe(1);
    expect(stored?.localId).toBe(row.localId);
  });

  describe('the outbox (8B)', () => {
    it('queues a DELETE when the request never reaches the server', async () => {
      const row = makeRow({ serverId: 3 });
      await seedNotes(row);

      server.use(http.delete(`${BASE}/notes/:noteId`, () => HttpResponse.error()));

      const { result } = renderDelete();
      await result.current(toView(row));

      const outbox = await outboxRepository.listForNote(row.localId);
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({ type: 'DELETE', noteId: 3 });
    });

    it('does NOT queue a DELETE for an ordinary server error, only a genuine disconnection', async () => {
      const row = makeRow({ serverId: 3 });
      await seedNotes(row);

      server.use(http.delete(`${BASE}/notes/:noteId`, () => new HttpResponse(null, { status: 500 })));

      const { result } = renderDelete();
      await result.current(toView(row));

      await expect(outboxRepository.listForNote(row.localId)).resolves.toEqual([]);
    });

    it('discards a queued CREATE when a never-synced note is trashed', async () => {
      const row = makeRow({ serverId: null, clientId: 'client-x', localId: 'local-x' });
      await seedNotes(row);
      await outboxRepository.enqueueCreate({
        localId: row.localId,
        clientId: row.clientId,
        content: row.content,
      });

      const { result } = renderDelete();
      await result.current(toView(row));

      await expect(outboxRepository.listForNote(row.localId)).resolves.toEqual([]);
    });
  });
});

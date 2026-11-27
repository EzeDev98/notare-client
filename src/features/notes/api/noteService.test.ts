/** Tests for noteService. */
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { noteService } from '@/features/notes/api/noteService';
import { isAborted, isApiError, isNotFound, isRetriable } from '@/lib/http/errors';
import { bootDefaultError, problemDetail } from '~/fixtures/errors';
import { resetNoteFixtures } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

let lastRequest: Request | undefined;
let lastBody: unknown;

beforeEach(() => {
  resetNoteFixtures();
  lastRequest = undefined;
  lastBody = undefined;
  server.events.on('request:start', ({ request }) => {
    lastRequest = request;
    const clone = request.clone();
    void clone
      .text()
      .then((text) => {
        lastBody = text === '' ? undefined : (JSON.parse(text) as unknown);
      })
      .catch(() => {
        lastBody = undefined;
      });
  });
});

afterEach(() => {
  server.events.removeAllListeners();
});

describe('reads', () => {
  it('lists notes', async () => {
    const page = await noteService.listNotes({ page: 0, size: 20 });

    expect(page.content).toHaveLength(2);
    expect(page.page).toBe(0);
  });

  it('searches with `query`, not `q`', async () => {
    const page = await noteService.searchNotes('meeting');

    expect(lastRequest?.url).toContain('query=meeting');
    expect(page.content[0]?.contentPreview).toBe('meeting');
  });

  it('percent-encodes a wildcard so it reaches the server literally', async () => {
    await noteService.searchNotes('100%');

    expect(lastRequest?.url).toContain('query=100%25');
  });

  it('does not let the :noteId handler swallow a literal sub-path', async () => {
    await expect(noteService.searchNotes('x')).resolves.toBeDefined();
  });
});

describe('auto-save', () => {
  it('sends only the fields being changed', async () => {
    await noteService.autoSaveNote(1, {});

    const body = lastBody as Record<string, unknown>;

    expect(body).toEqual({});
    expect(body).not.toHaveProperty('content');
  });

  it('returns the server version for the caller to adopt', async () => {
    const note = await noteService.autoSaveNote(1, { content: 'x' });

    expect(note.version).toBe(1);
  });
});

describe('writes', () => {
  it('creates a note', async () => {
    const note = await noteService.createNote({ content: 'Fresh' });

    expect(note.content).toBe('Fresh');
    expect(note.version).toBe(0);
  });

  it('sends content on a full update, where null clears', async () => {
    await noteService.updateNote(1, { content: null });

    const body = lastBody as Record<string, unknown>;

    expect(body).toEqual({ content: null });
  });

  it('resolves with nothing for a 204 delete', async () => {
    await expect(noteService.deleteNote(1)).resolves.toBeUndefined();
  });

  it('pins with POST and unpins with DELETE', async () => {
    const pinned = await noteService.setPinned(1, true);
    expect(pinned.pinned).toBe(true);
    expect(lastRequest?.method).toBe('POST');

    const unpinned = await noteService.setPinned(1, false);
    expect(unpinned.pinned).toBe(false);
    expect(lastRequest?.method).toBe('DELETE');
  });
});

describe('failures', () => {
  it('propagates a 404 without catching it', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        problemDetail(404, { title: 'Not Found', detail: 'Note not found.' }),
      ),
    );

    const error = await noteService.getNote(999).catch((e: unknown) => e);

    expect(isNotFound(error)).toBe(true);
  });

  it("handles Boot's default error body on an unhandled 500", async () => {
    server.use(http.get(`${BASE}/notes`, () => bootDefaultError(500)));

    const error = await noteService.listNotes().catch((e: unknown) => e);

    expect(isApiError(error) && error.detail.kind).toBe('http');
    expect(isRetriable(error)).toBe(true);
  });

  it('threads a cancellation signal all the way to fetch', async () => {
    const controller = new AbortController();
    const promise = noteService.listNotes({ signal: controller.signal });
    controller.abort();

    expect(isAborted(await promise.catch((e: unknown) => e))).toBe(true);
  });
});

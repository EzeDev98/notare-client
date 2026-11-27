import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { noteService } from '@/features/notes/api/noteService';
import { isAborted, isApiError, isNotFound, isRetriable } from '@/lib/http/errors';
import { bootDefaultError, problemDetail } from '~/fixtures/errors';
import { resetNoteFixtures } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

/**
 * Records what the service actually sent.
 *
 * The BODY is read at event time, not the Request object stored for later. A
 * request body is a single-use stream, and by the time an assertion runs the
 * MSW handler has already consumed it — clone() only helps if you clone before
 * the read, which is here. Storing the request and cloning later gives
 * "TypeError: unusable".
 */
let lastRequest: Request | undefined;
let lastBody: unknown;

beforeEach(() => {
  resetNoteFixtures();
  lastRequest = undefined;
  lastBody = undefined;
  server.events.on('request:start', ({ request }) => {
    lastRequest = request;
    // Clone NOW, while the stream is still unread, and read it eagerly.
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
    expect(page.page).toBe(0); // zero-based, per Spring's Pageable
  });

  it('searches with `query`, not `q`', async () => {
    /*
     * The server DOC says q; the controller says query. Getting this wrong is
     * a 400, because the parameter is required — not an empty result set,
     * which would be far easier to misread as "no matches".
     */
    const page = await noteService.searchNotes('meeting');

    expect(lastRequest?.url).toContain('query=meeting');
    expect(page.content[0]?.contentPreview).toBe('meeting');
  });

  it('percent-encodes a wildcard so it reaches the server literally', async () => {
    await noteService.searchNotes('100%');

    // The client half of B8: the server escapes % as a LIKE wildcard, this
    // encodes it for transport. Together, searching "100%" finds a percent
    // sign rather than every note you own.
    expect(lastRequest?.url).toContain('query=100%25');
  });

  it('does not let the :noteId handler swallow a literal sub-path', async () => {
    // Registration order in handlers.ts. Without literals first, this returns
    // a note with id NaN and no error at all.
    await expect(noteService.searchNotes('x')).resolves.toBeDefined();
  });
});

describe('auto-save', () => {
  it('sends only the fields being changed', async () => {
    await noteService.autoSaveNote(1, {});

    const body = lastBody as Record<string, unknown>;

    // An omitted field means "leave it alone" — content is the only other
    // field auto-save carries, and skipping it here confirms it never rides
    // along uninvited.
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

    // Explicit null, not omission. The type requires both fields precisely so
    // this cannot happen by accident.
    expect(body).toEqual({ content: null });
  });

  it('resolves with nothing for a 204 delete', async () => {
    // The empty-body case. `await response.json()` throws a SyntaxError here,
    // which is how a successful delete gets reported as a parse failure.
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

    /*
     * The service does not catch, and that is the design. A 409 means "show
     * the conflict UI" to the editor and "quarantine this operation" to the
     * sync engine; a service that caught would have to guess which caller it
     * had.
     *
     * Note also that 404 here means "no such note OR not yours" — the server
     * conflates them deliberately, so the UI must not say "this note was
     * deleted".
     */
    expect(isNotFound(error)).toBe(true);
  });

  it("handles Boot's default error body on an unhandled 500", async () => {
    // B2 unified most errors, not all. A client assuming every failure is a
    // ProblemDetail breaks on exactly the responses that mean the server is
    // already in trouble.
    server.use(http.get(`${BASE}/notes`, () => bootDefaultError(500)));

    const error = await noteService.listNotes().catch((e: unknown) => e);

    expect(isApiError(error) && error.detail.kind).toBe('http');
    expect(isRetriable(error)).toBe(true);
  });

  it('threads a cancellation signal all the way to fetch', async () => {
    const controller = new AbortController();
    const promise = noteService.listNotes({ signal: controller.signal });
    controller.abort();

    // Step 5 cancels on unmount and Step 6 on every superseded auto-save. A
    // service that dropped the signal would make both impossible.
    expect(isAborted(await promise.catch((e: unknown) => e))).toBe(true);
  });
});

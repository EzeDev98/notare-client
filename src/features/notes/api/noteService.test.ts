import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { noteService } from '@/features/notes/api/noteService';
import {
  conflictVersion,
  isAborted,
  isApiError,
  isConflict,
  isNotFound,
  isRetriable,
} from '@/lib/http/errors';
import { bareConflict, bootDefaultError, noteConflict, problemDetail } from '~/fixtures/errors';
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
  it('lists notes, excluding archived by default', async () => {
    const page = await noteService.listNotes({ page: 0, size: 20 });

    expect(page.content).toHaveLength(2);
    expect(page.page).toBe(0); // zero-based, per Spring's Pageable
  });

  it('sends the archived filter when asked for the archive', async () => {
    await noteService.listNotes({ archived: true });
    expect(lastRequest?.url).toContain('archived=true');
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

  it('reads the trash, including when each note was trashed', async () => {
    const page = await noteService.listTrash();

    expect(page.content[0]?.note.id).toBe(9);
    expect(page.content[0]?.deletedAt).toBe('2026-08-05T14:00:00.000');
  });

  it('does not let the :noteId handler swallow a literal sub-path', async () => {
    // Registration order in handlers.ts. Without literals first, this returns
    // a note with id NaN and no error at all.
    await expect(noteService.listTrash()).resolves.toBeDefined();
    await expect(noteService.searchNotes('x')).resolves.toBeDefined();
  });
});

describe('auto-save', () => {
  it('sends only the fields being changed', async () => {
    await noteService.autoSaveNote(1, { version: 3 });

    const body = lastBody as Record<string, unknown>;

    // An omitted field means "leave it alone" — content is the only other
    // field auto-save carries, and skipping it here confirms it never rides
    // along uninvited.
    expect(body).toEqual({ version: 3 });
    expect(body).not.toHaveProperty('content');
  });

  it('returns the server version for the caller to adopt', async () => {
    const note = await noteService.autoSaveNote(1, { content: 'x', version: 3 });

    /*
     * ECHOED, NEVER COUNTED. The client quotes the version it last received;
     * incrementing locally conflicts exactly as a stale value does.
     */
    expect(note.version).toBe(4);
  });

  it('surfaces a conflict carrying the server version', async () => {
    server.use(http.patch(`${BASE}/notes/:noteId`, () => noteConflict(9)));

    const error = await noteService
      .autoSaveNote(1, { content: 'x', version: 3 })
      .catch((e: unknown) => e);

    expect(isConflict(error)).toBe(true);
    expect(conflictVersion(error)).toBe(9);
  });

  it('surfaces a conflict WITHOUT a version, so the caller knows to refetch', async () => {
    /*
     * The flavour that breaks clients. ObjectOptimisticLockingFailureException
     * produces a 409 with no currentVersion, and it only appears under genuine
     * concurrency — awkward to reproduce against a real server, four lines as
     * a fixture. Step 6 must refetch here rather than assume the field exists.
     */
    server.use(http.patch(`${BASE}/notes/:noteId`, () => bareConflict()));

    const error = await noteService
      .autoSaveNote(1, { content: 'x', version: 3 })
      .catch((e: unknown) => e);

    expect(isConflict(error)).toBe(true);
    expect(conflictVersion(error)).toBeUndefined();
  });
});

describe('writes', () => {
  it('creates a note', async () => {
    const note = await noteService.createNote({ content: 'Fresh' });

    expect(note.content).toBe('Fresh');
    expect(note.version).toBe(0);
  });

  it('sends content and version on a full update, where null clears', async () => {
    await noteService.updateNote(1, { content: null, version: 2 });

    const body = lastBody as Record<string, unknown>;

    // Explicit null, not omission. The type requires both fields precisely so
    // this cannot happen by accident.
    expect(body).toEqual({ content: null, version: 2 });
  });

  it('resolves with nothing for a 204 permanent delete', async () => {
    // The empty-body case. `await response.json()` throws a SyntaxError here,
    // which is how a successful delete gets reported as a parse failure.
    await expect(noteService.permanentlyDeleteNote(1)).resolves.toBeUndefined();
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

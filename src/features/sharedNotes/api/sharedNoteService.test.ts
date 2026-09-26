import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sharedNoteService } from '@/features/sharedNotes/api/sharedNoteService';
import { isForbidden, isNotFound } from '@/lib/http/errors';
import { problemDetail } from '~/fixtures/errors';
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

describe('listSharedNotes', () => {
  it('lists notes shared with the current user, zero-based', async () => {
    const page = await sharedNoteService.listSharedNotes({ page: 0, size: 20 });

    expect(page.content).toHaveLength(1);
    expect(page.page).toBe(0);
    expect(lastRequest?.url).toContain(`${BASE}/shared-notes?`);
  });

  it('nests the owner note under `note`, not flattened', async () => {
    const page = await sharedNoteService.listSharedNotes();

    // Same shape the server sends: SharedNoteSummaryResponse embeds
    // NoteSummaryResponse rather than spreading its fields in place.
    expect(page.content[0]?.note.id).toBeDefined();
    expect(page.content[0]?.permission).toBe('READ');
    expect(page.content[0]?.ownerId).toBe(2);
  });
});

describe('getSharedNote', () => {
  it('requires nothing beyond a grant and returns the full note', async () => {
    const note = await sharedNoteService.getSharedNote(5);

    expect(note.id).toBe(5);
    expect(lastRequest?.method).toBe('GET');
  });

  it('answers 404 when there is no grant at all', async () => {
    server.use(
      http.get(`${BASE}/shared-notes/:noteId`, () =>
        problemDetail(404, { title: 'Not Found', detail: 'Note not found.' }),
      ),
    );

    const error = await sharedNoteService.getSharedNote(999).catch((e: unknown) => e);

    // Deliberately indistinguishable from "this note does not exist" —
    // NOTARE-SERVER.md §3.2: 404 must not confirm the row is real to
    // someone with no relationship to it.
    expect(isNotFound(error)).toBe(true);
  });
});

describe('updateSharedNote', () => {
  it('sends the full replacement body — content only, same as the owner path', async () => {
    await sharedNoteService.updateSharedNote(5, {
      content: null,
    });

    expect(lastBody).toEqual({ content: null });
  });

  it('returns the server version for the caller to adopt', async () => {
    const note = await sharedNoteService.updateSharedNote(5, {
      content: 'y',
    });

    expect(note.version).toBe(1);
  });

  it('answers 403, not 404, for a READ-only grant', async () => {
    server.use(
      http.put(`${BASE}/shared-notes/:noteId`, () =>
        problemDetail(403, {
          title: 'Forbidden',
          detail: 'This note is read-only for you.',
        }),
      ),
    );

    const error = await sharedNoteService
      .updateSharedNote(5, { content: 'y' })
      .catch((e: unknown) => e);

    // NOTARE-SERVER.md §3.2: 403 means the caller can already see the
    // resource but may not act on it — never 404 for this case, since a
    // READ-only collaborator's ability to open the note is not in question.
    expect(isForbidden(error)).toBe(true);
  });

});

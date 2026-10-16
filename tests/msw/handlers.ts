import { http, HttpResponse } from 'msw';

import { makeNote, makeNoteSummary, makePage } from '../fixtures/notes';
import { makeSharedNoteSummary } from '../fixtures/sharedNotes';
import { makeCollaboration, makeUserSummary } from '../fixtures/collaboration';
import { makeShare } from '../fixtures/shares';
import { makeLookupUser } from '../fixtures/userLookup';
import { makeNotification } from '../fixtures/notifications';
import { makeTranscription, makeVoiceNote } from '../fixtures/voice';

/**
 * Default handlers: the HAPPY PATH only. Failure cases are per-test overrides
 * via server.use(), so unrelated tests do not carry a reason to care.
 *
 * ORDER MATTERS. MSW matches in registration order, so /notes/:noteId
 * registered before /notes/search would swallow a search request and hand it
 * back a note with id NaN — no error, just nonsense. Literal paths go FIRST.
 *
 * Spring does this correctly on its own (literal segments outrank templates),
 * which is why /notes/search sits safely beside /notes/{noteId} on the server.
 * MSW does not, and neither do most client-side routers.
 */
const BASE = 'http://localhost:2001/api/v1';

export const handlers = [
  // ---- literal sub-paths, before the :noteId handler ---------------------
  http.get(`${BASE}/notes/search`, ({ request }) => {
    const term = new URL(request.url).searchParams.get('query');
    // The parameter is `query`, not `q`, and it is required.
    if (term === null) {
      return HttpResponse.json(
        { title: 'Bad Request', status: 400, detail: 'Required parameter is missing.' },
        { status: 400, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    return HttpResponse.json(makePage([makeNoteSummary({ id: 1, contentPreview: term })]));
  }),

  http.get(`${BASE}/notes/trash`, () =>
    HttpResponse.json(
      makePage([{ note: makeNoteSummary({ id: 9 }), deletedAt: '2026-08-05T14:00:00.000' }]),
    ),
  ),

  /*
   * useSync (AppLayout) mounts unconditionally and pulls on mount, in every
   * test that renders it — not just sync-specific tests. Missing this one
   * was invisible until now only because whatever else that test was doing
   * usually finished, or itself failed for its own reason, before the
   * background pull's request ever resolved; onUnhandledRequest: 'error'
   * (tests/setup.ts) means any test that outlasts that race throws
   * "intercepted a request without a matching request handler" for a
   * request the test itself never asked for or cares about. An honest
   * "nothing changed" response (empty `changed`/`deletedIds`, `hasMore:
   * false`) is a true no-op: pull.ts only writes the cursor `if
   * (latestCursor)`, and an empty string is falsy, so this never persists a
   * cursor either — a global default with no side effect for tests that
   * have nothing to do with sync.
   */
  http.get(`${BASE}/sync`, () =>
    HttpResponse.json({ changed: [], deletedIds: [], nextCursor: '', hasMore: false }),
  ),

  // ---- collection -------------------------------------------------------
  http.get(`${BASE}/notes`, () =>
    HttpResponse.json(makePage([makeNoteSummary({ id: 1 }), makeNoteSummary({ id: 2 })])),
  ),

  http.post(`${BASE}/notes`, async ({ request }) => {
    const body = (await request.json()) as { content?: string };
    return HttpResponse.json(makeNote({ ...body, version: 0 }), { status: 201 });
  }),

  // ---- single note ------------------------------------------------------
  http.get(`${BASE}/notes/:noteId`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']) })),
  ),

  http.patch(`${BASE}/notes/:noteId`, async ({ params, request }) => {
    const body = (await request.json()) as { content?: string; version?: number };

    // Mirrors the server's version bump, so a test can assert the client
    // ADOPTS the returned version rather than counting for itself.
    return HttpResponse.json(
      makeNote({ id: Number(params['noteId']), ...body, version: (body.version ?? 0) + 1 }),
    );
  }),

  http.put(`${BASE}/notes/:noteId`, async ({ params, request }) => {
    const body = (await request.json()) as {
      content: string | null;
      version?: number;
    };
    return HttpResponse.json(
      makeNote({ id: Number(params['noteId']), ...body, version: (body.version ?? 0) + 1 }),
    );
  }),

  http.post(`${BASE}/notes/:noteId/restore`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']) })),
  ),

  http.post(`${BASE}/notes/:noteId/pin`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']), pinned: true, version: 1 })),
  ),

  http.delete(`${BASE}/notes/:noteId/pin`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']), pinned: false, version: 1 })),
  ),

  // 204, no body — the case `await response.json()` chokes on (3B).
  http.delete(`${BASE}/notes/:noteId/permanent`, () => new HttpResponse(null, { status: 204 })),

  http.delete(`${BASE}/notes/:noteId`, () => new HttpResponse(null, { status: 204 })),

  // ---- shared notes (recipient side) -------------------------------------

  http.get(`${BASE}/shared-notes`, () => HttpResponse.json(makePage([makeSharedNoteSummary()]))),

  // ---- user lookup --------------------------------------------------

  // Every requested id resolves — matches makeLookupUser's own default
  // ("Jane Doe" regardless of id), which several pre-existing tests
  // already assumed before this handler existed to back that assumption.
  // A test that needs a genuinely unresolvable id (the "Unknown user"
  // fallback path) overrides this per-test via server.use() to return a
  // filtered subset instead.
  http.get(`${BASE}/user/lookup`, ({ request }) => {
    const ids = new URL(request.url).searchParams.getAll('ids').map(Number);
    return HttpResponse.json(ids.map((id) => makeLookupUser({ id })));
  }),

  // ---- user search ----------------------------------------------------

  http.get(`${BASE}/user/search`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? '';
    // Blank query -> empty page, matching the real server (this is other
    // people's data, not a browse-everyone endpoint).
    return HttpResponse.json(makePage(q === '' ? [] : [makeUserSummary()]));
  }),

  // ---- collaborations ---------------------------------------------------

  http.get(`${BASE}/collaborations/sent`, () => HttpResponse.json(makePage([makeCollaboration()]))),

  http.get(`${BASE}/collaborations/received`, () =>
    HttpResponse.json(makePage([makeCollaboration({ status: 'PENDING' })])),
  ),

  // ONLY collaboratorId — see collaboration/types.ts's corrected doc
  // comment on CreateCollaborationRequest. A collaboration is not scoped
  // to a note.
  http.post(`${BASE}/collaborations`, async ({ request }) => {
    const body = (await request.json()) as { collaboratorId: number };
    return HttpResponse.json(
      makeCollaboration({
        collaboratorId: body.collaboratorId,
        status: 'PENDING',
      }),
      { status: 201 },
    );
  }),

  http.post(`${BASE}/collaborations/:id/accept`, ({ params }) =>
    HttpResponse.json(makeCollaboration({ id: Number(params['id']), status: 'ACCEPTED' })),
  ),

  http.post(`${BASE}/collaborations/:id/reject`, ({ params }) =>
    HttpResponse.json(makeCollaboration({ id: Number(params['id']), status: 'REJECTED' })),
  ),

  http.delete(`${BASE}/collaborations/:id`, () => new HttpResponse(null, { status: 204 })),

  // ---- sharing (owner side) ----------------------------------------------

  http.get(`${BASE}/notes/:noteId/shares`, ({ params }) =>
    HttpResponse.json(makePage([makeShare({ noteId: Number(params['noteId']) })])),
  ),

  http.post(`${BASE}/notes/:noteId/shares`, async ({ params, request }) => {
    const body = (await request.json()) as { sharedWithUserId: number; permission: 'READ' | 'WRITE' };
    return HttpResponse.json(
      makeShare({
        noteId: Number(params['noteId']),
        sharedWithUserId: body.sharedWithUserId,
        permission: body.permission,
      }),
      { status: 201 },
    );
  }),

  http.put(`${BASE}/notes/:noteId/shares/:userId`, async ({ params, request }) => {
    const body = (await request.json()) as { permission: 'READ' | 'WRITE' };
    return HttpResponse.json(
      makeShare({
        noteId: Number(params['noteId']),
        sharedWithUserId: Number(params['userId']),
        permission: body.permission,
      }),
    );
  }),

  http.delete(`${BASE}/notes/:noteId/shares/:userId`, () => new HttpResponse(null, { status: 204 })),

  // ---- notifications ------------------------------------------------------

  http.get(`${BASE}/notifications`, () => HttpResponse.json(makePage([makeNotification()]))),

  http.get(`${BASE}/notifications/unread-count`, () => HttpResponse.json({ count: 1 })),

  http.post(`${BASE}/notifications/:id/read`, ({ params }) =>
    HttpResponse.json(
      makeNotification({ id: Number(params['id']), readAt: '2026-08-11T00:00:00.000' }),
    ),
  ),

  http.post(`${BASE}/notifications/read-all`, () => HttpResponse.json({ markedCount: 1 })),

  http.delete(`${BASE}/notifications/:id`, () => new HttpResponse(null, { status: 204 })),

  // ---- voice notes & transcription ----------------------------------------

  // Literal sub-path before /voice-notes/:voiceNoteId, same ordering
  // discipline as /notes/search above.
  http.get(`${BASE}/voice-notes/by-note/:noteId`, ({ params }) =>
    HttpResponse.json([makeVoiceNote({ noteId: Number(params['noteId']) })]),
  ),

  http.get(`${BASE}/voice-notes`, () => HttpResponse.json(makePage([makeVoiceNote()]))),

  // Upload goes through raw XHR (voiceService.ts's own doc comment), not
  // httpClient — but it is still an ordinary multipart POST as far as MSW
  // is concerned.
  http.post(`${BASE}/voice-notes`, ({ request }) => {
    const url = new URL(request.url);
    const noteId = url.searchParams.get('noteId');
    const durationSeconds = url.searchParams.get('durationSeconds');
    return HttpResponse.json(
      makeVoiceNote({
        noteId: noteId !== null ? Number(noteId) : null,
        durationSeconds: durationSeconds !== null ? Number(durationSeconds) : null,
      }),
      { status: 201 },
    );
  }),

  http.get(`${BASE}/voice-notes/:voiceNoteId`, ({ params }) =>
    HttpResponse.json(makeVoiceNote({ id: Number(params['voiceNoteId']) })),
  ),

  http.get(`${BASE}/voice-notes/:voiceNoteId/download`, () =>
    new HttpResponse(new Uint8Array([0, 1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/webm' },
    }),
  ),

  http.delete(`${BASE}/voice-notes/:voiceNoteId`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/voice-notes/:voiceNoteId/transcription`, ({ params }) =>
    HttpResponse.json(
      makeTranscription({ voiceNoteId: Number(params['voiceNoteId']), status: 'PENDING' }),
      { status: 202 },
    ),
  ),

  http.get(`${BASE}/voice-notes/:voiceNoteId/transcription`, ({ params }) =>
    HttpResponse.json(makeTranscription({ voiceNoteId: Number(params['voiceNoteId']) })),
  ),
];

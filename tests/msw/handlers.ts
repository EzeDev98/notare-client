import { http, HttpResponse } from 'msw';

import { makeNote, makeNoteSummary, makePage } from '../fixtures/notes';
import { makeSharedNoteSummary } from '../fixtures/sharedNotes';
import { makeCollaboration, makeUserSummary } from '../fixtures/collaboration';
import { makeShare } from '../fixtures/shares';
import { makeNotification } from '../fixtures/notifications';

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
    return HttpResponse.json(makePage([makeNoteSummary({ id: 1, title: term })]));
  }),

  http.get(`${BASE}/notes/trash`, () =>
    HttpResponse.json(
      makePage([{ note: makeNoteSummary({ id: 9 }), deletedAt: '2026-08-05T14:00:00.000' }]),
    ),
  ),

  // ---- collection -------------------------------------------------------
  http.get(`${BASE}/notes`, () =>
    HttpResponse.json(makePage([makeNoteSummary({ id: 1 }), makeNoteSummary({ id: 2 })])),
  ),

  http.post(`${BASE}/notes`, async ({ request }) => {
    const body = (await request.json()) as { title?: string; content?: string };
    return HttpResponse.json(makeNote({ ...body, version: 0 }), { status: 201 });
  }),

  // ---- single note ------------------------------------------------------
  http.get(`${BASE}/notes/:noteId`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']) })),
  ),

  http.patch(`${BASE}/notes/:noteId`, async ({ params, request }) => {
    const body = (await request.json()) as { title?: string; content?: string; version: number };

    // Mirrors the server's version bump, so a test can assert the client
    // ADOPTS the returned version rather than counting for itself.
    return HttpResponse.json(
      makeNote({ id: Number(params['noteId']), ...body, version: body.version + 1 }),
    );
  }),

  http.put(`${BASE}/notes/:noteId`, async ({ params, request }) => {
    const body = (await request.json()) as {
      title: string | null;
      content: string | null;
      version: number;
    };
    return HttpResponse.json(
      makeNote({ id: Number(params['noteId']), ...body, version: body.version + 1 }),
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

  // Returns the OWNER's NoteResponse shape — there is no
  // SharedNoteDetailResponse yet (sharedNoteService.ts's doc comment).
  http.get(`${BASE}/shared-notes/:noteId`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']), ownerId: 2 })),
  ),

  http.put(`${BASE}/shared-notes/:noteId`, async ({ params, request }) => {
    const body = (await request.json()) as {
      title: string | null;
      content: string | null;
      version: number;
    };
    return HttpResponse.json(
      makeNote({ id: Number(params['noteId']), ownerId: 2, ...body, version: body.version + 1 }),
    );
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

  // ONLY collaboratorId — see types.ts's corrected doc comment on
  // CreateCollaborationRequest. A collaboration is not scoped to a note.
  http.post(`${BASE}/collaborations`, async ({ request }) => {
    const body = (await request.json()) as { collaboratorId: number };
    return HttpResponse.json(
      makeCollaboration({
        collaborator: makeUserSummary({ id: body.collaboratorId }),
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
];

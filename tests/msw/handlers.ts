/** Default mock API handlers for tests, happy path only. */
import { http, HttpResponse } from 'msw';

import { makeNote, makeNoteSummary, makePage } from '../fixtures/notes';
import { makeNotification } from '../fixtures/notifications';
import { makeTranscription, makeVoiceNote } from '../fixtures/voice';

const BASE = 'http://localhost:2001/api/v1';

export const handlers = [
  http.get(`${BASE}/notes/search`, ({ request }) => {
    const term = new URL(request.url).searchParams.get('query');
    if (term === null) {
      return HttpResponse.json(
        { title: 'Bad Request', status: 400, detail: 'Required parameter is missing.' },
        { status: 400, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    return HttpResponse.json(makePage([makeNoteSummary({ id: 1, contentPreview: term })]));
  }),

  http.get(`${BASE}/sync`, () =>
    HttpResponse.json({ changed: [], deletedIds: [], nextCursor: '', hasMore: false }),
  ),

  http.get(`${BASE}/notes`, () =>
    HttpResponse.json(makePage([makeNoteSummary({ id: 1 }), makeNoteSummary({ id: 2 })])),
  ),

  http.post(`${BASE}/notes`, async ({ request }) => {
    const body = (await request.json()) as { content?: string };
    return HttpResponse.json(makeNote({ ...body, version: 0 }), { status: 201 });
  }),

  http.get(`${BASE}/notes/:noteId`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']) })),
  ),

  http.patch(`${BASE}/notes/:noteId`, async ({ params, request }) => {
    const body = (await request.json()) as { content?: string; version?: number };

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

  http.post(`${BASE}/notes/:noteId/pin`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']), pinned: true, version: 1 })),
  ),

  http.delete(`${BASE}/notes/:noteId/pin`, ({ params }) =>
    HttpResponse.json(makeNote({ id: Number(params['noteId']), pinned: false, version: 1 })),
  ),

  http.delete(`${BASE}/notes/:noteId`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/notifications`, () => HttpResponse.json(makePage([makeNotification()]))),

  http.get(`${BASE}/notifications/unread-count`, () => HttpResponse.json({ count: 1 })),

  http.post(`${BASE}/notifications/:id/read`, ({ params }) =>
    HttpResponse.json(
      makeNotification({ id: Number(params['id']), readAt: '2026-08-11T00:00:00.000' }),
    ),
  ),

  http.post(`${BASE}/notifications/read-all`, () => HttpResponse.json({ markedCount: 1 })),

  http.delete(`${BASE}/notifications/:id`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/voice-notes/by-note/:noteId`, ({ params }) =>
    HttpResponse.json([makeVoiceNote({ noteId: Number(params['noteId']) })]),
  ),

  http.get(`${BASE}/voice-notes`, () => HttpResponse.json(makePage([makeVoiceNote()]))),

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

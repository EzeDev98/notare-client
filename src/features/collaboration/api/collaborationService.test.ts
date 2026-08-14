import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { collaborationService } from '@/features/collaboration/api/collaborationService';
import { isBadRequest, isForbidden, isNotFound } from '@/lib/http/errors';
import { problemDetail } from '~/fixtures/errors';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

describe('createCollaboration', () => {
  it('creates a PENDING invitation as owner', async () => {
    const result = await collaborationService.createCollaboration({
      noteId: 5,
      collaboratorId: 7,
      permission: 'READ',
    });

    expect(result.status).toBe('PENDING');
    expect(result.collaborator.id).toBe(7);
  });
});

describe('acceptCollaboration / rejectCollaboration', () => {
  it('accepting is idempotent — an already-ACCEPTED invite still returns 200', async () => {
    server.use(
      http.post(`${BASE}/collaborations/:id/accept`, ({ params }) =>
        HttpResponse.json({
          id: Number(params['id']),
          status: 'ACCEPTED',
        }),
      ),
    );

    const result = await collaborationService.acceptCollaboration(1);
    expect(result.status).toBe('ACCEPTED');
  });

  it('rejecting an already-ACCEPTED invite is a 400, not a silent no-op', async () => {
    server.use(
      http.post(`${BASE}/collaborations/:id/reject`, () =>
        problemDetail(400, {
          title: 'Bad Request',
          detail: 'Cannot reject an accepted invitation.',
        }),
      ),
    );

    const error = await collaborationService.rejectCollaboration(1).catch((e: unknown) => e);
    expect(isBadRequest(error)).toBe(true);
  });

  it('acting on someone else\'s invitation is a 404, not a 403', async () => {
    server.use(
      http.post(`${BASE}/collaborations/:id/accept`, () =>
        problemDetail(404, { title: 'Not Found', detail: 'Invitation not found.' }),
      ),
    );

    // NOTARE-SERVER.md §8: "invitee only" is enforced by the query itself,
    // so a mismatch reads as "does not exist", not "exists but forbidden".
    const error = await collaborationService.acceptCollaboration(1).catch((e: unknown) => e);
    expect(isNotFound(error)).toBe(true);
    expect(isForbidden(error)).toBe(false);
  });
});

describe('cancelCollaboration', () => {
  it('deletes the row and resolves with no body', async () => {
    await expect(collaborationService.cancelCollaboration(1)).resolves.toBeUndefined();
  });
});

describe('listSent / listReceived', () => {
  it('lists the current user\'s sent invitations', async () => {
    const page = await collaborationService.listSent();
    expect(page.content).toHaveLength(1);
  });

  it('lists the current user\'s received invitations', async () => {
    const page = await collaborationService.listReceived();
    expect(page.content[0]?.status).toBe('PENDING');
  });
});

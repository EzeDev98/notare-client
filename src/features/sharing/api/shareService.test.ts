import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { shareService } from '@/features/sharing/api/shareService';
import { isBadRequest, isForbidden, isNotFound } from '@/lib/http/errors';
import { problemDetail } from '~/fixtures/errors';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

describe('listShares', () => {
  it('lists the grants on a note', async () => {
    const page = await shareService.listShares(5);
    expect(page.content[0]?.noteId).toBe(5);
  });
});

describe('createShare', () => {
  it('creates a grant for the given user and permission', async () => {
    const result = await shareService.createShare(5, { sharedWithUserId: 7, permission: 'WRITE' });
    expect(result.sharedWithUserId).toBe(7);
    expect(result.permission).toBe('WRITE');
  });

  it('surfaces a duplicate grant as a client error, not a silent success', async () => {
    server.use(
      http.post(`${BASE}/notes/:noteId/shares`, () =>
        problemDetail(400, { title: 'Bad Request', detail: 'Already shared with this user.' }),
      ),
    );

    const error = await shareService
      .createShare(5, { sharedWithUserId: 7, permission: 'READ' })
      .catch((e: unknown) => e);
    expect(isBadRequest(error)).toBe(true);
  });

  it('sharing someone else\'s note is a 404, not a 403 — ownership is not confirmed to a caller with no relationship to it', async () => {
    server.use(
      http.post(`${BASE}/notes/:noteId/shares`, () =>
        problemDetail(404, { title: 'Not Found', detail: 'Note not found.' }),
      ),
    );

    const error = await shareService
      .createShare(5, { sharedWithUserId: 7, permission: 'READ' })
      .catch((e: unknown) => e);
    expect(isNotFound(error)).toBe(true);
    expect(isForbidden(error)).toBe(false);
  });
});

describe('updateShare', () => {
  it('changes the permission on an existing grant', async () => {
    const result = await shareService.updateShare(5, 7, { permission: 'WRITE' });
    expect(result.permission).toBe('WRITE');
  });
});

describe('revokeShare', () => {
  it('deletes the grant and resolves with no body', async () => {
    await expect(shareService.revokeShare(5, 7)).resolves.toBeUndefined();
  });
});

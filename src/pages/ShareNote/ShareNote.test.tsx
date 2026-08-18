import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { ShareNotePage } from '@/pages/ShareNote/ShareNote';
import { makeCollaboration } from '~/fixtures/collaboration';
import { makeShare } from '~/fixtures/shares';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderShareNote(path = '/notes/5/share') {
  const router = createMemoryRouter(
    [
      { path: '/notes/:noteId/share', element: <ShareNotePage /> },
      { path: '/notes/:noteId', element: <h1>Note detail</h1> },
      { path: '/collaborations', element: <h1>Collaborations</h1> },
    ],
    { initialEntries: [path] },
  );
  return render(
    <SignedIn>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </SignedIn>,
  );
}

describe('sharing a note (owner side)', () => {
  it('resolves a grant\'s bare sharedWithUserId to a name via accepted collaborations', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId/shares`, () =>
        HttpResponse.json({
          content: [makeShare({ sharedWithUserId: 2, permission: 'READ' })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.get(`${BASE}/collaborations/sent`, () =>
        HttpResponse.json({
          content: [
            makeCollaboration({
              status: 'ACCEPTED',
              collaboratorId: 2,
            }),
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
    );

    renderShareNote();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });

  /*
   * PRE-12A this asserted `User 99` — the OLD resolveName's own fallback
   * for an unmatched id. 12a replaced that resolution with the batch
   * `useUserLookup` feature, whose fallback chain (`formatUserName`) ends
   * at "Unknown user", not a raw id — exactly the case this test exercises
   * (no accepted collaboration at all means id 99 is never even looked up,
   * so `profiles.get(99)` is `undefined`). Updated to match the actual,
   * intentional behaviour rather than the placeholder 12a existed to
   * remove.
   */
  it('falls back to "Unknown user" when no accepted collaboration matches the grant', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId/shares`, () =>
        HttpResponse.json({
          content: [makeShare({ sharedWithUserId: 99 })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.get(`${BASE}/collaborations/sent`, () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
    );

    renderShareNote();

    expect(await screen.findByText('Unknown user')).toBeInTheDocument();
  });

  it('excludes an already-granted collaborator from the share picker', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId/shares`, () =>
        HttpResponse.json({
          content: [makeShare({ sharedWithUserId: 2 })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.get(`${BASE}/collaborations/sent`, () =>
        HttpResponse.json({
          content: [
            makeCollaboration({
              status: 'ACCEPTED',
              collaboratorId: 2,
            }),
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
    );

    renderShareNote();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    // Only accepted collaborator already has a grant, so the form has
    // nothing left to offer — the two-stage-flow message shows instead.
    expect(screen.getByText(/already has access/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Share with')).not.toBeInTheDocument();
  });

  it('revoking removes the row', async () => {
    let revoked = false;
    server.use(
      http.get(`${BASE}/notes/:noteId/shares`, () =>
        HttpResponse.json({
          content: revoked ? [] : [makeShare({ sharedWithUserId: 2 })],
          page: 0,
          size: 20,
          totalElements: revoked ? 0 : 1,
          totalPages: revoked ? 0 : 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.get(`${BASE}/collaborations/sent`, () =>
        HttpResponse.json({
          content: [
            makeCollaboration({
              status: 'ACCEPTED',
              collaboratorId: 2,
            }),
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.delete(`${BASE}/notes/:noteId/shares/:userId`, () => {
        revoked = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderShareNote();

    await screen.findByText('Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    // Not "Jane Doe" gone entirely — she legitimately reappears in the
    // share picker's <option> once no longer granted. It's the GRANT row
    // (and its Revoke button) that must disappear.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Not shared with anyone yet.')).toBeInTheDocument();
  });
});

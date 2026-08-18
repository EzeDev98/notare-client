import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { ShareVoiceNotePage } from '@/pages/ShareVoiceNote/ShareVoiceNote';
import { makeCollaboration } from '~/fixtures/collaboration';
import { makeVoiceShare } from '~/fixtures/voiceShares';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

/**
 * Mirrors `ShareNote.test.tsx`'s own `renderShareNote` exactly — same
 * placeholder-sibling-routes shape, adapted to the voice path params.
 */
function renderShareVoiceNote(path = '/voice/5/share') {
  const router = createMemoryRouter(
    [
      { path: '/voice/:voiceNoteId/share', element: <ShareVoiceNotePage /> },
      { path: '/voice/:voiceNoteId', element: <h1>Voice detail</h1> },
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

/**
 * The SAME four cases as `ShareNote.test.tsx`, against the voice endpoints —
 * this page mirrors `ShareNotePage`'s implementation deliberately (its own
 * doc comment), so its test coverage mirrors `ShareNote.test.tsx`'s
 * one-for-one rather than inventing a different set of cases for
 * structurally identical code.
 */
describe('sharing a voice note (owner side)', () => {
  it("resolves a grant's bare sharedWithUserId to a name via accepted collaborations", async () => {
    server.use(
      http.get(`${BASE}/voice-notes/:voiceNoteId/shares`, () =>
        HttpResponse.json({
          content: [makeVoiceShare({ sharedWithUserId: 2, permission: 'READ' })],
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
          content: [makeCollaboration({ status: 'ACCEPTED', collaboratorId: 2 })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
    );

    renderShareVoiceNote();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });

  it('falls back to "Unknown user" when no accepted collaboration matches the grant', async () => {
    server.use(
      http.get(`${BASE}/voice-notes/:voiceNoteId/shares`, () =>
        HttpResponse.json({
          content: [makeVoiceShare({ sharedWithUserId: 99 })],
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

    renderShareVoiceNote();

    expect(await screen.findByText('Unknown user')).toBeInTheDocument();
  });

  it('excludes an already-granted collaborator from the share picker', async () => {
    server.use(
      http.get(`${BASE}/voice-notes/:voiceNoteId/shares`, () =>
        HttpResponse.json({
          content: [makeVoiceShare({ sharedWithUserId: 2 })],
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
          content: [makeCollaboration({ status: 'ACCEPTED', collaboratorId: 2 })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
    );

    renderShareVoiceNote();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    // Only accepted collaborator already has a grant, so the form has
    // nothing left to offer — the two-stage-flow message shows instead.
    expect(screen.getByText(/already has access/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Share with')).not.toBeInTheDocument();
  });

  it('revoking removes the row', async () => {
    let revoked = false;
    server.use(
      http.get(`${BASE}/voice-notes/:voiceNoteId/shares`, () =>
        HttpResponse.json({
          content: revoked ? [] : [makeVoiceShare({ sharedWithUserId: 2 })],
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
          content: [makeCollaboration({ status: 'ACCEPTED', collaboratorId: 2 })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.delete(`${BASE}/voice-notes/:voiceNoteId/shares/:userId`, () => {
        revoked = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderShareVoiceNote();

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

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { InviteCollaboratorPage } from '@/pages/InviteCollaborator/InviteCollaborator';
import { makeCollaboration, makeUserSummary } from '~/fixtures/collaboration';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderInvitePage() {
  const router = createMemoryRouter(
    [
      { path: '/collaborations/invite', element: <InviteCollaboratorPage /> },
      { path: '/collaborations', element: <h1>Collaborations</h1> },
    ],
    { initialEntries: ['/collaborations/invite'] },
  );
  return render(
    <SignedIn>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </SignedIn>,
  );
}

describe('inviting a collaborator', () => {
  it('sends only collaboratorId, with no note or permission involved', async () => {
    let capturedBody: unknown = null;
    server.use(
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
      http.get(`${BASE}/user/search`, () =>
        HttpResponse.json({
          content: [makeUserSummary({ id: 42, firstName: 'Grace', lastName: 'Hopper', username: 'grace' })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.post(`${BASE}/collaborations`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          makeCollaboration({ collaborator: { id: 42, notarianId: 'NTR-42', username: 'grace', firstName: 'Grace', lastName: 'Hopper' } }),
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderInvitePage();

    await user.type(screen.getByLabelText('Add a collaborator'), 'grace');
    const result = await screen.findByRole('option', { name: /Grace Hopper/i });
    await user.click(result);

    await waitFor(() => {
      expect(capturedBody).toEqual({ collaboratorId: 42 });
    });
    expect(await screen.findByText(/Invited Grace Hopper/)).toBeInTheDocument();
  });

  it('excludes people already in the sent list, regardless of status', async () => {
    server.use(
      http.get(`${BASE}/collaborations/sent`, () =>
        HttpResponse.json({
          content: [
            makeCollaboration({
              status: 'REJECTED',
              collaborator: { id: 42, notarianId: 'NTR-42', username: 'grace', firstName: 'Grace', lastName: 'Hopper' },
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
      http.get(`${BASE}/user/search`, () =>
        HttpResponse.json({
          content: [makeUserSummary({ id: 42, firstName: 'Grace', lastName: 'Hopper', username: 'grace' })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
    );

    const user = userEvent.setup();
    renderInvitePage();

    await user.type(screen.getByLabelText('Add a collaborator'), 'grace');

    expect(await screen.findByText('No one found.')).toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { InvitationsPage } from '@/pages/Invitations/Invitations';
import { makeCollaboration } from '~/fixtures/collaboration';
import { problemDetail } from '~/fixtures/errors';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderInvitations() {
  const router = createMemoryRouter(
    [
      { path: '/collaborations', element: <InvitationsPage /> },
      { path: '/collaborations/invite', element: <h1>Invite</h1> },
    ],
    { initialEntries: ['/collaborations'] },
  );
  return render(
    <SignedIn>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </SignedIn>,
  );
}

describe('collaborations — received', () => {
  it('shows a pending invitation, from the owner, with accept/reject affordances', async () => {
    server.use(
      http.get(`${BASE}/collaborations/received`, () =>
        HttpResponse.json({
          content: [
            makeCollaboration({
              id: 1,
              status: 'PENDING',
              owner: { id: 9, notarianId: 'NTR-9', username: 'femi', firstName: 'Femi', lastName: 'Ade' },
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

    renderInvitations();

    expect(await screen.findByText('Femi Ade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('accepting removes the row from received on success', async () => {
    let accepted = false;
    server.use(
      http.get(`${BASE}/collaborations/received`, () =>
        HttpResponse.json({
          content: accepted ? [] : [makeCollaboration({ id: 1, status: 'PENDING' })],
          page: 0,
          size: 20,
          totalElements: accepted ? 0 : 1,
          totalPages: accepted ? 0 : 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.post(`${BASE}/collaborations/1/accept`, () => {
        accepted = true;
        return HttpResponse.json(makeCollaboration({ id: 1, status: 'ACCEPTED' }));
      }),
    );

    const user = userEvent.setup();
    renderInvitations();

    await screen.findByRole('button', { name: 'Accept' });
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    });
  });

  it('surfaces a 400 as "already resolved", not a generic failure', async () => {
    server.use(
      http.get(`${BASE}/collaborations/received`, () =>
        HttpResponse.json({
          content: [makeCollaboration({ id: 1, status: 'PENDING' })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.post(`${BASE}/collaborations/1/accept`, () =>
        problemDetail(400, { title: 'Bad Request', detail: 'Already rejected.' }),
      ),
    );

    const user = userEvent.setup();
    renderInvitations();

    await screen.findByRole('button', { name: 'Accept' });
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText(/already resolved/i)).toBeInTheDocument();
  });
});

describe('collaborations — sent', () => {
  it('lets the owner cancel a relationship of any status, not only PENDING', async () => {
    let cancelled = false;
    server.use(
      http.get(`${BASE}/collaborations/sent`, () =>
        HttpResponse.json({
          content: cancelled
            ? []
            : [
                makeCollaboration({
                  id: 2,
                  status: 'ACCEPTED',
                  collaborator: {
                    id: 3,
                    notarianId: 'NTR-3',
                    username: 'jane',
                    firstName: 'Jane',
                    lastName: 'Doe',
                  },
                }),
              ],
          page: 0,
          size: 20,
          totalElements: cancelled ? 0 : 1,
          totalPages: cancelled ? 0 : 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.delete(`${BASE}/collaborations/2`, () => {
        cancelled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderInvitations();

    await user.click(screen.getByRole('tab', { name: 'Sent' }));

    const row = (await screen.findByText('Jane Doe')).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Accepted')).toBeInTheDocument();

    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });
  });

  it('links to the invite flow', async () => {
    server.use(
      http.get(`${BASE}/collaborations/received`, () =>
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

    const user = userEvent.setup();
    renderInvitations();

    await user.click(screen.getByRole('link', { name: 'Invite someone' }));
    expect(await screen.findByText('Invite')).toBeInTheDocument();
  });
});

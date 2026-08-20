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
              ownerId: 9,
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

describe('collaborations — received', () => {
  it('confirms before rejecting an invitation', async () => {
    let rejected = false;

    server.use(
      http.get(`${BASE}/collaborations/received`, () =>
        HttpResponse.json({
          content: rejected ? [] : [makeCollaboration({ id: 1, status: 'PENDING', ownerId: 9 })],
          page: 0,
          size: 20,
          totalElements: rejected ? 0 : 1,
          totalPages: rejected ? 0 : 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.post(`${BASE}/collaborations/1/reject`, () => {
        rejected = true;
        return HttpResponse.json(makeCollaboration({ id: 1, status: 'REJECTED' }));
      }),
    );

    const user = userEvent.setup();
    renderInvitations();

    await user.click(await screen.findByRole('button', { name: 'Reject' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Reject this invite?');
    expect(dialog).toHaveTextContent("You won't get access to");

    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    });
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
                  collaboratorId: 3,
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

    await user.click(
      within(row as HTMLElement).getByRole('button', { name: 'Cancel' }),
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Cancel this invite?');

    await user.click(
      within(dialog).getByRole('button', { name: 'Cancel invite' }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });
  });

  it('confirms before cancelling an invitation', async () => {
    let cancelled = false;

    server.use(
      http.get(`${BASE}/collaborations/sent`, () =>
        HttpResponse.json({
          content: cancelled
            ? []
            : [makeCollaboration({ id: 2, status: 'PENDING', collaboratorId: 3 })],
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

    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Cancel' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Cancel this invite?');
    expect(dialog).toHaveTextContent(
      'This invitation will no longer be available to the recipient.',
    );

    await user.click(
      within(dialog).getByRole('button', { name: 'Cancel invite' }),
    );

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

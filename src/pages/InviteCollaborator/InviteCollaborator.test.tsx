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
      {
        path: '/collaborations/invite',
        element: <InviteCollaboratorPage />,
      },
      {
        path: '/collaborations',
        element: <h1>Collaborations</h1>,
      },
      {
        path: '/',
        element: <h1>My Notes</h1>,
      },
    ],
    {
      initialEntries: ['/collaborations/invite'],
    },
  );

  return render(
    <SignedIn>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </SignedIn>,
  );
}

function mockSearch(user = makeUserSummary()) {
  server.use(
    http.get(`${BASE}/user/search`, () =>
      HttpResponse.json({
        content: [user],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      }),
    ),
  );
}

function mockSentCollaborations(
  content: ReturnType<typeof makeCollaboration>[] = [],
) {
  server.use(
    http.get(`${BASE}/collaborations/sent`, () =>
      HttpResponse.json({
        content,
        page: 0,
        size: 20,
        totalElements: content.length,
        totalPages: content.length > 0 ? 1 : 0,
        hasNext: false,
        hasPrevious: false,
      }),
    ),
  );
}

describe('inviting a collaborator', () => {
  it('invites a user who has never been invited before', async () => {
    let capturedBody: unknown = null;

    mockSentCollaborations();

    mockSearch(
      makeUserSummary({
        id: 42,
        firstName: 'Grace',
        lastName: 'Hopper',
        username: 'grace',
      }),
    );

    server.use(
      http.post(`${BASE}/collaborations`, async ({ request }) => {
        capturedBody = await request.json();

        return HttpResponse.json(
          makeCollaboration({
            collaboratorId: 42,
            status: 'PENDING',
          }),
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();

    renderInvitePage();

    await user.type(
      screen.getByLabelText('Add a collaborator'),
      'grace',
    );

    const result = await screen.findByRole('option', {
      name: /Grace Hopper/i,
    });

    await user.click(result);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        collaboratorId: 42,
      });
    });

    expect(
      await screen.findByText(/Invited Grace Hopper/i),
    ).toBeInTheDocument();
  });

  it('shows a rejected collaborator and allows inviting them again', async () => {
    let capturedBody: unknown = null;

    mockSentCollaborations([
      makeCollaboration({
        collaboratorId: 42,
        status: 'REJECTED',
      }),
    ]);

    mockSearch(
      makeUserSummary({
        id: 42,
        firstName: 'Grace',
        lastName: 'Hopper',
        username: 'grace',
      }),
    );

    server.use(
      http.post(`${BASE}/collaborations`, async ({ request }) => {
        capturedBody = await request.json();

        return HttpResponse.json(
          makeCollaboration({
            collaboratorId: 42,
            status: 'PENDING',
          }),
          { status: 200 },
        );
      }),
    );

    const user = userEvent.setup();

    renderInvitePage();

    await user.type(
      screen.getByLabelText('Add a collaborator'),
      'grace',
    );

    const result = await screen.findByRole('option', {
      name: /Grace Hopper/i,
    });

    await user.click(result);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        collaboratorId: 42,
      });
    });

    expect(
      await screen.findByText(/Invited Grace Hopper/i),
    ).toBeInTheDocument();
  });

  it('shows a modal for a pending collaborator and does not send another invitation', async () => {
    let postCalled = false;

    mockSentCollaborations([
      makeCollaboration({
        collaboratorId: 42,
        status: 'PENDING',
      }),
    ]);

    mockSearch(
      makeUserSummary({
        id: 42,
        firstName: 'Grace',
        lastName: 'Hopper',
        username: 'grace',
      }),
    );

    server.use(
      http.post(`${BASE}/collaborations`, () => {
        postCalled = true;

        return HttpResponse.json(
          makeCollaboration({
            collaboratorId: 42,
            status: 'PENDING',
          }),
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();

    renderInvitePage();

    await user.type(
      screen.getByLabelText('Add a collaborator'),
      'grace',
    );

    const result = await screen.findByRole('option', {
      name: /Grace Hopper/i,
    });

    await user.click(result);

    expect(
      await screen.findByRole('dialog'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        name: /Invitation already sent/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Invitation already sent/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Grace Hopper'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Once they accept, you can share your notes/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: /Go to my notes/i,
      }),
    ).toHaveAttribute('href', '/');

    expect(postCalled).toBe(false);
  });

  it('shows a modal for an accepted collaborator and does not send another invitation', async () => {
    let postCalled = false;

    mockSentCollaborations([
      makeCollaboration({
        collaboratorId: 42,
        status: 'ACCEPTED',
      }),
    ]);

    mockSearch(
      makeUserSummary({
        id: 42,
        firstName: 'Grace',
        lastName: 'Hopper',
        username: 'grace',
      }),
    );

    server.use(
      http.post(`${BASE}/collaborations`, () => {
        postCalled = true;

        return HttpResponse.json(
          makeCollaboration({
            collaboratorId: 42,
            status: 'ACCEPTED',
          }),
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();

    renderInvitePage();

    await user.type(
      screen.getByLabelText('Add a collaborator'),
      'grace',
    );

    const result = await screen.findByRole('option', {
      name: /Grace Hopper/i,
    });

    await user.click(result);

    expect(
      await screen.findByRole('dialog'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        name: /You’re already collaborators/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/You’re already collaborators/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Grace Hopper'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /To share a note with them, open the note you want to share/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: /Go to my notes/i,
      }),
    ).toHaveAttribute('href', '/');

    expect(postCalled).toBe(false);
  });

  it('closes the existing collaborator modal without navigating', async () => {
    mockSentCollaborations([
      makeCollaboration({
        collaboratorId: 42,
        status: 'ACCEPTED',
      }),
    ]);

    mockSearch(
      makeUserSummary({
        id: 42,
        firstName: 'Grace',
        lastName: 'Hopper',
        username: 'grace',
      }),
    );

    const user = userEvent.setup();

    renderInvitePage();

    await user.type(
      screen.getByLabelText('Add a collaborator'),
      'grace',
    );

    const result = await screen.findByRole('option', {
      name: /Grace Hopper/i,
    });

    await user.click(result);

    expect(
      await screen.findByRole('dialog'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Close',
      }),
    );

    // Modal.tsx defers onClose until its exit animation finishes — or,
    // under jsdom where animationend never fires, its 250ms fallback timer.
    // A synchronous assertion here would catch the dialog mid-close, still
    // sitting at `data-closing="true"`.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

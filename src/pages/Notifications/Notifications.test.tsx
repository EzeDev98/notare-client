import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { NotificationsPage } from '@/pages/Notifications/Notifications';
import { makeCollaboration } from '~/fixtures/collaboration';
import { makeNotification } from '~/fixtures/notifications';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderNotifications() {
  return render(
    <SignedIn>
      <QueryProvider>
        <NotificationsPage />
      </QueryProvider>
    </SignedIn>,
  );
}

function emptyCollaborationsPage() {
  return HttpResponse.json({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
}

describe('notifications list', () => {
  it('composes the message with a resolved actor from accepted collaborations', async () => {
    server.use(
      http.get(`${BASE}/notifications`, () =>
        HttpResponse.json({
          content: [
            makeNotification({
              id: 1,
              type: 'NOTE_SHARED',
              actorId: 9,
              targetLabel: 'Q3 Plan',
              readAt: null,
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
      http.get(`${BASE}/collaborations/received`, () =>
        HttpResponse.json({
          content: [
            makeCollaboration({
              status: 'ACCEPTED',
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
      http.get(`${BASE}/collaborations/sent`, emptyCollaborationsPage),
      http.get(`${BASE}/notifications/unread-count`, () => HttpResponse.json({ count: 1 })),
    );

    renderNotifications();

    expect(await screen.findByText('Femi Ade shared “Q3 Plan” with you')).toBeInTheDocument();
  });

  it('marks a single notification read and it stops offering "Mark read"', async () => {
    let read = false;
    server.use(
      http.get(`${BASE}/notifications`, () =>
        HttpResponse.json({
          content: [makeNotification({ id: 1, readAt: read ? '2026-08-11T00:00:00.000' : null })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.get(`${BASE}/collaborations/received`, emptyCollaborationsPage),
      http.get(`${BASE}/collaborations/sent`, emptyCollaborationsPage),
      http.get(`${BASE}/notifications/unread-count`, () =>
        HttpResponse.json({ count: read ? 0 : 1 }),
      ),
      http.post(`${BASE}/notifications/1/read`, () => {
        read = true;
        return HttpResponse.json(makeNotification({ id: 1, readAt: '2026-08-11T00:00:00.000' }));
      }),
    );

    const user = userEvent.setup();
    renderNotifications();

    await user.click(await screen.findByRole('button', { name: 'Mark read' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Mark read' })).not.toBeInTheDocument();
    });
  });

  it('deletes a notification and it disappears from the list', async () => {
    let deleted = false;
    server.use(
      http.get(`${BASE}/notifications`, () =>
        HttpResponse.json({
          content: deleted ? [] : [makeNotification({ id: 1 })],
          page: 0,
          size: 20,
          totalElements: deleted ? 0 : 1,
          totalPages: deleted ? 0 : 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.get(`${BASE}/collaborations/received`, emptyCollaborationsPage),
      http.get(`${BASE}/collaborations/sent`, emptyCollaborationsPage),
      http.get(`${BASE}/notifications/unread-count`, () => HttpResponse.json({ count: deleted ? 0 : 1 })),
      http.delete(`${BASE}/notifications/1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderNotifications();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Q3 Plan', { exact: false })).not.toBeInTheDocument();
    });
  });

  it('renders a generic line for an unrecognised notification type, not a crash or a blank row', async () => {
    server.use(
      http.get(`${BASE}/notifications`, () =>
        HttpResponse.json({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- simulating a server type this client predates
          content: [makeNotification({ id: 1, type: 'SOMETHING_FUTURE' as any })],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
      http.get(`${BASE}/collaborations/received`, emptyCollaborationsPage),
      http.get(`${BASE}/collaborations/sent`, emptyCollaborationsPage),
      http.get(`${BASE}/notifications/unread-count`, () => HttpResponse.json({ count: 1 })),
    );

    renderNotifications();

    expect(await screen.findByText('You have a new notification')).toBeInTheDocument();
  });
});

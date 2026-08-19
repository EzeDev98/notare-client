import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { SharedVoiceDetailPage } from '@/pages/SharedVoiceDetail/SharedVoiceDetail';
import { problemDetail } from '~/fixtures/errors';
import { makeSharedVoiceNoteSummary } from '~/fixtures/sharedVoiceNotes';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderSharedVoiceDetail(path = '/shared-voice/7') {
  const router = createMemoryRouter(
    [
      { path: '/shared-voice/:voiceNoteId', element: <SharedVoiceDetailPage /> },
      { path: '/shared', element: <h1>Shared with me</h1> },
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

describe('a shared voice note (recipient side)', () => {
  it('renders the recording\'s info and opens the player', async () => {
    server.use(
      http.get(`${BASE}/shared-voice-notes/:voiceNoteId`, () =>
        HttpResponse.json(
          makeSharedVoiceNoteSummary({
            voiceNoteId: 7,
            ownerId: 2,
            permission: 'READ',
            originalFilename: 'Memo.webm',
          }),
        ),
      ),
    );

    const { container } = renderSharedVoiceDetail();

    // The title now renders through the same `EditorSurface` used by
    // `/shared/:id` — a read-only "Note title" field, not a heading.
    const titleField = await screen.findByLabelText('Note title');
    expect(titleField).toHaveValue('Memo.webm');
    expect(titleField).toHaveAttribute('readonly');

    expect(screen.getByText(/Read only/)).toBeInTheDocument();

    await waitFor(() => {
      const mode = container.querySelector('.shared-note__mode');
      expect(mode?.textContent).toContain('Shared by Jane Doe');
    });

    await waitFor(() => {
      const audio = container.querySelector('audio');
      expect(audio).not.toBeNull();
      expect(audio?.getAttribute('src')).toMatch(/^blob:/);
    });
  });

  it('shows "Not shared with you" when the recipient holds no grant', async () => {
    server.use(
      http.get(`${BASE}/shared-voice-notes/:voiceNoteId`, () =>
        problemDetail(404, { title: 'Not Found' }),
      ),
    );

    renderSharedVoiceDetail();

    expect(await screen.findByRole('heading', { name: 'Not shared with you' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to shared with me' })).toHaveAttribute(
      'href',
      '/shared',
    );
  });

  it('shows a generic error with retry on a non-404 failure, and recovers on retry', async () => {
    let failing = true;
    server.use(
      http.get(`${BASE}/shared-voice-notes/:voiceNoteId`, () =>
        failing
          ? problemDetail(500)
          : HttpResponse.json(
              makeSharedVoiceNoteSummary({ voiceNoteId: 7, originalFilename: 'Memo.webm' }),
            ),
      ),
    );

    const user = userEvent.setup();
    renderSharedVoiceDetail();

    expect(
      await screen.findByRole('heading', { name: "Can't open this recording" }),
    ).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('Note title')).toHaveValue('Memo.webm');
  });
});

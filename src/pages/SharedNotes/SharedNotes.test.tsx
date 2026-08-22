import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { QueryProvider } from '@/app/providers/QueryProvider';
import { SharedNotesPage } from '@/pages/SharedNotes/SharedNotes';
import { problemDetail } from '~/fixtures/errors';
import { makeNoteSummary, makePage } from '~/fixtures/notes';
import { makeSharedNoteSummary } from '~/fixtures/sharedNotes';
import { makeSharedVoiceNoteSummary } from '~/fixtures/sharedVoiceNotes';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderShared(path = '/shared') {
  const router = createMemoryRouter(
    [
      { path: '/shared', element: <SharedNotesPage /> },
      { path: '/shared/:noteId', element: <h1>Shared note detail</h1> },
      { path: '/shared-voice/:voiceNoteId', element: <h1>Shared voice detail</h1> },
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

function emptyBoth() {
  server.use(
    http.get(`${BASE}/shared-notes`, () => HttpResponse.json(makePage([]))),
    http.get(`${BASE}/shared-voice-notes`, () => HttpResponse.json(makePage([]))),
  );
}

describe('Shared with me', () => {
  it('renders a single merged feed with no All/Notes/Voice tabs', async () => {
    emptyBoth();
    renderShared();

    expect(await screen.findByRole('heading', { name: 'Shared with me' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows a shared note as a note-shaped card, with the owner name resolved', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([makeSharedNoteSummary({ note: makeNoteSummary({ contentPreview: 'Cooking' }) })]),
        ),
      ),
      http.get(`${BASE}/shared-voice-notes`, () => HttpResponse.json(makePage([]))),
    );

    renderShared();

    const heading = await screen.findByRole('heading', { name: 'Cooking' });
    const card = heading.closest('li');
    expect(card?.textContent).toMatch(/Read only/);

    await waitFor(() => {
      expect(card?.textContent).toContain('Shared by Jane Doe');
    });
  });

  it('shows a standalone shared voice note as a note-shaped card, with the owner name resolved', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () => HttpResponse.json(makePage([]))),
      http.get(`${BASE}/shared-voice-notes`, () =>
        HttpResponse.json(
          makePage([makeSharedVoiceNoteSummary({ originalFilename: 'Memo.webm' })]),
        ),
      ),
    );

    renderShared();

    const heading = await screen.findByRole('heading', { name: 'Memo.webm' });
    const card = heading.closest('li');
    await waitFor(() => {
      expect(card?.textContent).toContain('Shared by Jane Doe');
    });
  });

  it('does not give a voice note attached to a shared note its own row', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([
            makeSharedNoteSummary({ note: makeNoteSummary({ id: 42, contentPreview: 'Cooking' }) }),
          ]),
        ),
      ),
      http.get(`${BASE}/shared-voice-notes`, () =>
        // noteId !== null -> attached to note 42, must not surface as its own row
        HttpResponse.json(
          makePage([
            makeSharedVoiceNoteSummary({
              voiceNoteId: 7,
              noteId: 42,
              originalFilename: 'Attached.webm',
            }),
          ]),
        ),
      ),
    );

    renderShared();

    await screen.findByRole('heading', { name: 'Cooking' });
    expect(screen.queryByRole('heading', { name: 'Attached.webm' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('combines notes and standalone voice notes in one feed, newest sharedAt first', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([
            makeSharedNoteSummary({
              note: makeNoteSummary({ contentPreview: 'Older note' }),
              sharedAt: '2026-08-01T09:00:00.000',
            }),
          ]),
        ),
      ),
      http.get(`${BASE}/shared-voice-notes`, () =>
        HttpResponse.json(
          makePage([
            makeSharedVoiceNoteSummary({
              originalFilename: 'Newer voice.webm',
              sharedAt: '2026-08-05T09:00:00.000',
            }),
          ]),
        ),
      ),
    );

    renderShared();

    await screen.findByRole('heading', { name: 'Newer voice.webm' });
    const headings = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('h2')?.textContent);
    expect(headings).toEqual(['Newer voice.webm', 'Older note']);
  });

  it('does not flash the empty state while both collections are still loading', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, async () => {
        await delay(50);
        return HttpResponse.json(makePage([]));
      }),
      http.get(`${BASE}/shared-voice-notes`, async () => {
        await delay(50);
        return HttpResponse.json(makePage([]));
      }),
    );

    renderShared();

    expect(screen.getByText('Loading shared notes')).toBeInTheDocument();
    expect(screen.queryByText('Nothing shared with you yet')).not.toBeInTheDocument();

    expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();
    expect(screen.queryByText('Loading shared notes')).not.toBeInTheDocument();
  });

  it('keeps showing a successfully loaded collection when the other one fails', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([makeSharedNoteSummary({ note: makeNoteSummary({ contentPreview: 'Cooking' }) })]),
        ),
      ),
      http.get(`${BASE}/shared-voice-notes`, () => problemDetail(500)),
    );

    renderShared();

    expect(await screen.findByRole('heading', { name: 'Cooking' })).toBeInTheDocument();
    expect(
      await screen.findByText("Some shared items couldn't be loaded right now."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your shared notes.")).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing shared with you yet')).not.toBeInTheDocument();
  });

  it('shows one merged empty state when both collections genuinely resolve empty', async () => {
    emptyBoth();
    renderShared();

    expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();
  });

  it('shows a full-page error with retry when both collections fail', async () => {
    let failing = true;
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        failing ? problemDetail(500) : HttpResponse.json(makePage([])),
      ),
      http.get(`${BASE}/shared-voice-notes`, () =>
        failing ? problemDetail(500) : HttpResponse.json(makePage([])),
      ),
    );

    const user = userEvent.setup();
    renderShared();

    expect(
      await screen.findByText("Couldn't load your shared notes."),
    ).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();
  });

  it('navigates to /shared/:noteId when a shared note is clicked', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([
            makeSharedNoteSummary({ note: makeNoteSummary({ id: 42, contentPreview: 'Cooking' }) }),
          ]),
        ),
      ),
      http.get(`${BASE}/shared-voice-notes`, () => HttpResponse.json(makePage([]))),
    );

    const user = userEvent.setup();
    renderShared();

    await user.click(await screen.findByRole('link', { name: /Cooking/ }));

    expect(await screen.findByRole('heading', { name: 'Shared note detail' })).toBeInTheDocument();
  });

  it('navigates to /shared-voice/:voiceNoteId and opens the player when a shared voice note is clicked', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () => HttpResponse.json(makePage([]))),
      http.get(`${BASE}/shared-voice-notes`, () =>
        HttpResponse.json(
          makePage([
            makeSharedVoiceNoteSummary({ voiceNoteId: 7, originalFilename: 'Memo.webm' }),
          ]),
        ),
      ),
    );

    const user = userEvent.setup();
    renderShared();

    await user.click(await screen.findByRole('link', { name: /Memo\.webm/ }));

    expect(
      await screen.findByRole('heading', { name: 'Shared voice detail' }),
    ).toBeInTheDocument();
  });
});

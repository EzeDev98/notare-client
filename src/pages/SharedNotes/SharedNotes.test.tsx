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
  it('renders with the All tab selected by default', async () => {
    emptyBoth();
    renderShared();

    expect(await screen.findByRole('heading', { name: 'Shared with me' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Voice' })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows a shared note on the All tab, with the owner name resolved', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([makeSharedNoteSummary({ note: makeNoteSummary({ title: 'Cooking' }) })]),
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

  it('shows a shared voice note on the All tab, with the owner name resolved', async () => {
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

  it('combines notes and voice notes on the All tab, newest sharedAt first', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([
            makeSharedNoteSummary({
              note: makeNoteSummary({ title: 'Older note' }),
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
    const titles = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('h2')?.textContent);
    expect(titles).toEqual(['Newer voice.webm', 'Older note']);
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

    expect(screen.getByText('Loading shared items')).toBeInTheDocument();
    expect(screen.queryByText('Nothing shared with you yet')).not.toBeInTheDocument();

    expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();
    expect(screen.queryByText('Loading shared items')).not.toBeInTheDocument();
  });

  it('keeps showing a successfully loaded collection when the other one fails', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([makeSharedNoteSummary({ note: makeNoteSummary({ title: 'Cooking' }) })]),
        ),
      ),
      http.get(`${BASE}/shared-voice-notes`, () => problemDetail(500)),
    );

    renderShared();

    expect(await screen.findByRole('heading', { name: 'Cooking' })).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load shared voice notes.")).toBeInTheDocument();
    expect(
      screen.queryByText("Couldn't load what's been shared with you."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing shared with you yet')).not.toBeInTheDocument();
  });

  it('shows the correct per-tab empty state once both collections have genuinely resolved empty', async () => {
    emptyBoth();
    const user = userEvent.setup();
    renderShared();

    expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(await screen.findByText('No shared notes yet')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Voice' }));
    expect(await screen.findByText('No shared voice notes yet')).toBeInTheDocument();
  });

  it('navigates to /shared/:noteId when a shared note is clicked', async () => {
    server.use(
      http.get(`${BASE}/shared-notes`, () =>
        HttpResponse.json(
          makePage([
            makeSharedNoteSummary({ note: makeNoteSummary({ id: 42, title: 'Cooking' }) }),
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

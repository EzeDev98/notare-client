import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { NotesPage } from '@/pages/Notes/Notes';
import { expectNoAxeViolations } from '~/a11y';
import { makeNoteSummary, makePage } from '~/fixtures/notes';
import type { NoteSummaryResponse } from '@/features/notes/types';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderNotes() {
  const router = createMemoryRouter([{ path: '/notes', element: <NotesPage /> }], {
    initialEntries: ['/notes'],
  });
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('the notes list', () => {
  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderNotes();
    await screen.findByRole('link', { name: /note 1/i });
    await expectNoAxeViolations(container);
  });

  it('renders each note as a link, not a clickable div', async () => {
    renderNotes();

    /*
     * A link gives middle-click, right-click-copy, Enter, and a "link"
     * announcement for free. A div with onClick throws all of that away and
     * then reimplements a fraction of it badly.
     */
    const link = await screen.findByRole('link', { name: /note 1/i });
    expect(link).toHaveAttribute('href', '/notes/1');
  });

  it('shows an empty state that offers the action which fills it', async () => {
    server.use(http.get(`${BASE}/notes`, () => HttpResponse.json(makePage([]))));
    renderNotes();

    // "No notes" alone tells the user what they can already see.
    expect(await screen.findByRole('heading', { name: /nothing here yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /write your first note/i })).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    server.use(http.get(`${BASE}/notes`, () => new HttpResponse(null, { status: 500 })));
    renderNotes();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('labels an untitled note rather than rendering an empty heading', async () => {
    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json(makePage([makeNoteSummary({ id: 7, title: null })])),
      ),
    );
    renderNotes();

    expect(await screen.findByText(/untitled/i)).toBeInTheDocument();
  });

  it('appends the next page and reports the new count', async () => {
    const first = [makeNoteSummary({ id: 1 }), makeNoteSummary({ id: 2 })];
    const second = [makeNoteSummary({ id: 3 })];

    server.use(
      http.get(`${BASE}/notes`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '0');
        return HttpResponse.json(
          page === 0
            ? makePage(first, { totalElements: 3, size: 2, page: 0 })
            : makePage(second, { totalElements: 3, size: 2, page: 1 }),
        );
      }),
    );

    const user = userEvent.setup();
    renderNotes();

    await screen.findByRole('link', { name: /note 1/i });
    await user.click(screen.getByRole('button', { name: /load more/i }));

    // Appended, not replaced.
    expect(await screen.findByRole('link', { name: /note 3/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /note 1/i })).toBeInTheDocument();

    // Announced, because twenty new rows are silent to a screen reader.
    expect(screen.getByRole('status')).toHaveTextContent(/showing 3 of 3/i);
  });

  it('hides the button when there is nothing more to load', async () => {
    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json(makePage([makeNoteSummary({ id: 1 })], { totalElements: 1 })),
      ),
    );
    renderNotes();

    await screen.findByRole('link', { name: /note 1/i });
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('does not repeat a note that moved between pages', async () => {
    /*
     * The offset-pagination symptom. The list is ordered by updatedAt DESC, so
     * a note edited while paging jumps to the top and shifts everything after
     * it — page 1 then returns something page 0 already showed.
     *
     * The duplicate is what this dedupe removes. The note it SKIPPED is
     * invisible and unrecoverable here, which is why Step 7 moves this read
     * path onto Dexie rather than papering over it.
     */
    const overlapping: NoteSummaryResponse[] = [
      makeNoteSummary({ id: 2 }),
      makeNoteSummary({ id: 3 }),
    ];

    server.use(
      http.get(`${BASE}/notes`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '0');
        return HttpResponse.json(
          page === 0
            ? makePage([makeNoteSummary({ id: 1 }), makeNoteSummary({ id: 2 })], {
                totalElements: 4,
                size: 2,
              })
            : makePage(overlapping, { totalElements: 4, size: 2, page: 1 }),
        );
      }),
    );

    const user = userEvent.setup();
    renderNotes();

    await screen.findByRole('link', { name: /note 1/i });
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByRole('link', { name: /note 3/i });
    expect(screen.getAllByRole('link', { name: /note 2/i })).toHaveLength(1);
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { SearchPage } from '@/pages/Search/Search';
import { makeNoteSummary, makePage } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderSearch(path = '/search') {
  const router = createMemoryRouter(
    [
      { path: '/search', element: <SearchPage /> },
      { path: '/notes/:noteId', element: <h1>A note</h1> },
    ],
    { initialEntries: [path] },
  );

  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('searching', () => {
  it('prompts rather than listing everything before a term is entered', async () => {
    let requested = false;
    server.use(
      http.get(`${BASE}/notes/search`, () => {
        requested = true;
        return HttpResponse.json(makePage([]));
      }),
    );

    renderSearch();
    await screen.findByRole('heading', { name: /search/i });

    /*
     * No request for an empty term. The server treats a blank `query` as
     * "match everything" for notes, so a naive implementation would dump the
     * whole note list into a search screen the user has not used yet.
     */
    expect(requested).toBe(false);
    expect(screen.getByText(/search across the titles/i)).toBeInTheDocument();
  });

  it('runs a search from a term in the URL', async () => {
    server.use(
      http.get(`${BASE}/notes/search`, () =>
        HttpResponse.json(makePage([makeNoteSummary({ id: 1, title: 'Meeting notes' })])),
      ),
    );

    // Why the URL carries the term: ?q= is worth sharing, bookmarking and
    // going back to, unlike a page number.
    renderSearch('/search?q=meeting');

    expect(await screen.findByRole('link', { name: /meeting notes/i })).toBeInTheDocument();
  });

  it('makes one request for a burst of typing', async () => {
    let requests = 0;
    server.use(
      http.get(`${BASE}/notes/search`, () => {
        requests += 1;
        return HttpResponse.json(makePage([makeNoteSummary({ id: 1, title: 'Meeting notes' })]));
      }),
    );

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'meeting');
    await screen.findByRole('link', { name: /meeting notes/i });

    // Seven characters, one request. Without the debounce this is seven.
    expect(requests).toBe(1);
  });

  it('ignores a slow response for a term the user has moved past', async () => {
    /*
     * THE TEST THIS SUBSECTION EXISTS FOR.
     *
     * Debouncing reduces how many requests happen; it does nothing about the
     * order they return in. A slow "no" landing after a fast "note" would show
     * results that do not match what is in the box.
     *
     * AbortController handles most of this and cannot handle all of it — a
     * promise that has already resolved cannot be un-resolved — which is why
     * the hook also carries a generation counter.
     */
    server.use(
      http.get(`${BASE}/notes/search`, async ({ request }) => {
        const term = new URL(request.url).searchParams.get('query') ?? '';

        if (term === 'slow') {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return HttpResponse.json(makePage([makeNoteSummary({ id: 99, title: 'Stale result' })]));
        }
        return HttpResponse.json(makePage([makeNoteSummary({ id: 1, title: 'Fresh result' })]));
      }),
    );

    const user = userEvent.setup();
    renderSearch();

    const field = await screen.findByLabelText(/search your notes/i);
    await user.type(field, 'slow');
    await user.clear(field);
    await user.type(field, 'fast');

    expect(await screen.findByRole('link', { name: /fresh result/i })).toBeInTheDocument();

    // Give the slow response time to arrive and be discarded.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole('link', { name: /stale result/i })).not.toBeInTheDocument();
  });

  it('reports the result count for a screen reader', async () => {
    server.use(
      http.get(`${BASE}/notes/search`, () =>
        HttpResponse.json(
          makePage([makeNoteSummary({ id: 1, title: 'Meeting notes' })], { totalElements: 1 }),
        ),
      ),
    );

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'meeting');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/1 note match/i);
    });
  });

  it('says nothing matched, without pretending the search failed', async () => {
    server.use(http.get(`${BASE}/notes/search`, () => HttpResponse.json(makePage([]))));

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'zzzz');

    expect(await screen.findByText(/no notes match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });
});

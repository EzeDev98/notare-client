import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { parseNoteId } from '@/features/notes/hooks/useNote';
import { NoteDetailPage } from '@/pages/NoteDetail/NoteDetail';
import { expectNoAxeViolations } from '~/a11y';
import { makeNote } from '~/fixtures/notes';
import { problemDetail } from '~/fixtures/errors';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderDetail(path = '/notes/1') {
  const router = createMemoryRouter(
    [
      { path: '/notes/:noteId', element: <NoteDetailPage /> },
      { path: '/notes', element: <h1>All notes</h1> },
    ],
    { initialEntries: [path] },
  );

  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

describe('parseNoteId', () => {
  it('accepts a positive integer', () => {
    expect(parseNoteId('42')).toBe(42);
  });

  it('rejects junk that parseInt would silently truncate', () => {
    // parseInt('12abc') returns 12 and requests a note nobody asked for.
    expect(parseNoteId('12abc')).toBeNull();
    expect(parseNoteId('abc')).toBeNull();
  });

  it('rejects the values that look plausible but are not ids', () => {
    // Number('') is 0, which would otherwise pass as an id.
    expect(parseNoteId('')).toBeNull();
    expect(parseNoteId(undefined)).toBeNull();
    expect(parseNoteId('0')).toBeNull();
    expect(parseNoteId('-3')).toBeNull();
    expect(parseNoteId('1.5')).toBeNull();
  });
});

describe('the note detail view', () => {
  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderDetail();
    await screen.findByRole('heading', { name: /note 1/i });
    await expectNoAxeViolations(container);
  });

  it('preserves the newlines the user typed', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, title: 'Lists', content: 'one\ntwo\nthree' })),
      ),
    );
    renderDetail();

    /*
     * normalizer: identity. getByText COLLAPSES whitespace by default —
     * newlines become spaces before matching — so the default matcher can
     * never see the line breaks this test is about.
     *
     * The text arrives intact and CSS white-space: pre-wrap renders the
     * breaks. Storing markup would have been the alternative, and a far worse
     * one.
     */
    expect(
      await screen.findByText('one\ntwo\nthree', { normalizer: (text) => text }),
    ).toBeInTheDocument();
  });

  it('renders angle brackets as text rather than markup', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: '<script>alert(1)</script>' })),
      ),
    );
    const { container } = renderDetail();

    expect(await screen.findByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('does not request anything for an unparseable id', async () => {
    let requested = false;
    server.use(
      http.get(`${BASE}/notes/:noteId`, () => {
        requested = true;
        return HttpResponse.json(makeNote({ id: 1 }));
      }),
    );

    renderDetail('/notes/abc');

    expect(await screen.findByRole('heading', { name: /note not found/i })).toBeInTheDocument();
    // A local not-found, not a server error for /notes/NaN.
    expect(requested).toBe(false);
  });

  it('does not claim a missing note was deleted', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        problemDetail(404, { title: 'Not Found', detail: 'Note not found.' }),
      ),
    );
    renderDetail('/notes/999');

    /*
     * The server conflates "no such note" with "not yours" so that a distinct
     * 403 cannot confirm a note exists. The wording has to be true in both
     * cases — "deleted" would be a confident guess, wrong half the time.
     */
    expect(await screen.findByRole('heading', { name: /note not found/i })).toBeInTheDocument();
    expect(screen.getByText(/isn't available to you/i)).toBeInTheDocument();
  });

  it('says so when a note has no content', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, title: 'Empty', content: null })),
      ),
    );
    renderDetail();

    expect(await screen.findByText(/this note is empty/i)).toBeInTheDocument();
  });
});

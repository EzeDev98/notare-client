/** Tests for NoteDetail. */
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/design-system/ui';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { parseNoteId } from '@/features/notes/hooks/useNote';
import { NoteDetailPage } from '@/pages/NoteDetail/NoteDetail';
import { expectNoAxeViolations } from '~/a11y';
import { makeNote } from '~/fixtures/notes';
import { problemDetail } from '~/fixtures/errors';
import { SignedIn } from '~/harness';
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
    <SignedIn>
      <QueryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryProvider>
    </SignedIn>,
  );
}

describe('parseNoteId', () => {
  it('accepts a positive integer', () => {
    expect(parseNoteId('42')).toBe(42);
  });

  it('rejects junk that parseInt would silently truncate', () => {
    expect(parseNoteId('12abc')).toBeNull();
    expect(parseNoteId('abc')).toBeNull();
  });

  it('rejects the values that look plausible but are not ids', () => {
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
    await screen.findByLabelText('Note content');
    await expectNoAxeViolations(container);
  });

  it('preserves the newlines the user typed', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: 'one\ntwo\nthree' })),
      ),
    );
    renderDetail();

    const content = await screen.findByLabelText('Note content');
    await waitFor(() => {
      expect(content.querySelectorAll('p')).toHaveLength(3);
    });
    expect(content).toHaveTextContent('one');
    expect(content).toHaveTextContent('two');
    expect(content).toHaveTextContent('three');
  });

  it('renders angle brackets as text rather than markup', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: '<script>alert(1)</script>' })),
      ),
    );
    const { container } = renderDetail();

    expect(await screen.findByLabelText('Note content')).toHaveTextContent(
      '<script>alert(1)</script>',
    );
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
    expect(requested).toBe(false);
  });

  it('does not claim a missing note was deleted', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        problemDetail(404, { title: 'Not Found', detail: 'Note not found.' }),
      ),
    );
    renderDetail('/notes/999');

    expect(await screen.findByRole('heading', { name: /note not found/i })).toBeInTheDocument();
    expect(screen.getByText(/isn't available to you/i)).toBeInTheDocument();
  });

  it('shows an empty writing surface for a note with no content', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: null })),
      ),
    );
    renderDetail();

    const content = await screen.findByLabelText('Note content');
    expect(content).toHaveTextContent('');
    expect(content).not.toHaveAttribute('placeholder');
  });
});

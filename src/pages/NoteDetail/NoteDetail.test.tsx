import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
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
    // Waits for the note to load before running axe; the exact content is
    // covered elsewhere, this test only cares that the editor has rendered.
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

    /*
     * Since the TipTap rewrite the field is a contenteditable div, not a
     * textarea — it has no `.value`, and a `<br>` element contributes
     * NOTHING to `.textContent` (verified directly), so a plain string
     * comparison can't tell "one\ntwo\nthree" apart from "onetwothree".
     * What actually matters — and what a collapsed run-on paragraph would
     * fail — is that three SEPARATE lines exist in the DOM. EditorSurface.tsx
     * configures `breaks: true` specifically so a bare `\n` (every note ever
     * written in the old textarea has no other kind) becomes a real <br>
     * rather than collapsing to a space; this asserts that mapping held.
     */
    const content = await screen.findByLabelText('Note content');
    expect(content.querySelectorAll('br')).toHaveLength(2);
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

    // Markdown.configure's `html: false` (EditorSurface.tsx) is what makes
    // this safe now — a literal `<script>` in the source is escaped text,
    // never parsed as markup, verified directly: editor.getHTML() for this
    // exact input is `<p>&lt;script&gt;...&lt;/script&gt;</p>`. No `.value`
    // to compare against a plain string here, so this reads the rendered
    // text instead — still proving the same thing: the tag survives as
    // characters, not as an element.
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

  it('shows an empty writing surface for a note with no content', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: null })),
      ),
    );
    renderDetail();

    /*
     * An empty note is now an empty writing surface with a placeholder, not a
     * sentence telling the user there is nothing here. In a read view "This
     * note is empty" was information; in an editor it would be a label on the
     * blank page they are about to write on.
     */
    const content = await screen.findByLabelText('Note content');
    expect(content).toHaveTextContent('');
    expect(content).not.toHaveAttribute('placeholder');
  });
});

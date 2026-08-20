import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { NotesPage } from '@/pages/Notes/Notes';
import { expectNoAxeViolations } from '~/a11y';
import { makePage, makeRow } from '~/fixtures/notes';
import { seedNotes, SignedIn, TEST_USER } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

/**
 * The server has nothing beyond what this test seeded.
 *
 * Needed since 7E. The default handler returns notes 1 and 2, and until 7E the
 * rows it inserted carried ownerId null — invisible to a query scoped by owner,
 * so a test could assert an empty list while two notes sat in the database. Now
 * the refresh inserts them correctly, which means a test about ONE note has to
 * say so rather than relying on the other being swallowed.
 */
function serverHasNoNotes() {
  server.use(http.get(`${BASE}/notes`, () => HttpResponse.json(makePage([]))));
}

/**
 * The list renders from DEXIE, so these tests seed the database.
 *
 * Three tests were deleted here rather than repaired — "appends the next
 * page", "hides the button when there is nothing more to load", and "does not
 * repeat a note that moved between pages". They tested offset pagination and
 * its dedupe workaround, and 7C retired that design: the list reads a complete
 * local set, so there is no page 1, no Load more, and no window for a note to
 * shift between pages. Keeping them would have meant reintroducing the bug
 * they were written to catch.
 */
function renderNotes({ archived = false } = {}) {
  const router = createMemoryRouter(
    [{ path: '/notes', element: <NotesPage archived={archived} /> }],
    {
      initialEntries: ['/notes'],
    },
  );

  return render(
    <SignedIn>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SignedIn>,
  );
}

describe('the notes list', () => {
  it('has no automatically detectable accessibility violations', async () => {
    await seedNotes(makeRow({ serverId: 1, title: 'Note 1', ownerId: TEST_USER.id }));
    const { container } = renderNotes();

    await screen.findByRole('link', { name: /note 1/i });
    await expectNoAxeViolations(container);
  });

  it('renders each note as a link, not a clickable div', async () => {
    await seedNotes(makeRow({ serverId: 1, title: 'Note 1', ownerId: TEST_USER.id }));
    renderNotes();

    /*
     * A link gives middle-click, right-click-copy, Enter, and a "link"
     * announcement for free. A div with onClick throws all of that away and
     * then reimplements a fraction of it badly.
     */
    const link = await screen.findByRole('link', { name: /note 1/i });
    expect(link).toHaveAttribute('href', '/notes/1');
  });

  it('routes an offline-created note by its local id', async () => {
    // The reason NoteView carries localId at all: this note has no server id
    // and still has to be openable.
    await seedNotes(
      makeRow({
        serverId: null,
        localId: 'local-abc',
        title: 'Drafted offline',
        ownerId: TEST_USER.id,
      }),
    );
    renderNotes();

    const link = await screen.findByRole('link', { name: /drafted offline/i });
    expect(link).toHaveAttribute('href', '/notes/local/local-abc');
  });

  it('shows an empty state that offers the action which fills it', async () => {
    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 100,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }),
      ),
    );
    renderNotes();

    // "No notes" alone tells the user what they can already see.
    expect(await screen.findByRole('heading', { name: /nothing here yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /write your first note/i })).toBeInTheDocument();
  });

  it('keeps local notes on screen when the refresh fails', async () => {
    /*
     * The offline-first inversion, and the single most important behaviour on
     * this page. Before 7C a failed load replaced the screen with an error.
     * Now the notes are already local, so the failure is an aside.
     */
    await seedNotes(makeRow({ serverId: 1, title: 'Saved here', ownerId: TEST_USER.id }));
    server.use(http.get(`${BASE}/notes`, () => new HttpResponse(null, { status: 500 })));
    renderNotes();

    expect(await screen.findByRole('link', { name: /saved here/i })).toBeInTheDocument();
    expect(await screen.findByText(/showing notes saved on this device/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('labels an untitled note rather than rendering an empty heading', async () => {
    await seedNotes(makeRow({ serverId: 7, title: '', ownerId: TEST_USER.id }));
    renderNotes();

    expect(await screen.findByText(/untitled/i)).toBeInTheDocument();
  });

  it('pins a note without waiting for the server', async () => {
    await seedNotes(makeRow({ serverId: 1, title: 'Note 1', pinned: 0, ownerId: TEST_USER.id }));

    // The server never answers. The pin must still land, because the local
    // write is the operation.
    server.use(
      http.patch(`${BASE}/notes/:noteId/pin`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderNotes();

    await user.click(await screen.findByRole('button', { name: /^pin note 1$/i }));

    expect(await screen.findByRole('button', { name: /unpin note 1/i })).toBeInTheDocument();
    expect(screen.getByText(/pinned/i)).toBeInTheDocument();
  });

  it('moves a note to the trash and offers an undo', async () => {
    serverHasNoNotes();
    await seedNotes(makeRow({ serverId: 1, title: 'Note 1', ownerId: TEST_USER.id }));

    const user = userEvent.setup();
    renderNotes();

    await user.click(await screen.findByRole('button', { name: /delete note 1/i }));

    const deleteModal = await screen.findByRole('dialog');

    await user.click(
      within(deleteModal).getByRole('button', { name: 'Delete', exact: true }),
    );

    // Gone from the list, because `deleted` is part of the live query's
    // predicate — nothing told the list to remove it.
    await screen.findByRole('heading', { name: /nothing here yet/i });
    expect(screen.queryByRole('link', { name: /note 1/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /undo/i }));
    expect(await screen.findByRole('link', { name: /note 1/i })).toBeInTheDocument();
  });

  it('archiving removes the note from the main list', async () => {
    serverHasNoNotes();
    await seedNotes(makeRow({ serverId: 1, title: 'Note 1', ownerId: TEST_USER.id }));

    const user = userEvent.setup();
    renderNotes();

    await user.click(await screen.findByRole('button', { name: /archive note 1/i }));

    await screen.findByRole('heading', { name: /nothing here yet/i });
  });
});

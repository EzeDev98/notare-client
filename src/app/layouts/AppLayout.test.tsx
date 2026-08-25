import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/router';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { makeNote, makePage, makeRow } from '~/fixtures/notes';
import { resetDatabase, seedNotes, SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <SignedIn>
        <QueryProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryProvider>
      </SignedIn>
    </ThemeProvider>,
  );
}

describe('the toolbar delete icon', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('is disabled when no note is open', async () => {
    renderAt('/notes');

    expect(await screen.findByRole('button', { name: 'Delete note' })).toBeDisabled();
  });

  it('trashes the open server-backed note and returns to the list', async () => {
    await seedNotes(makeRow({ serverId: 7, localId: 'local-7' }));

    const user = userEvent.setup();
    renderAt('/notes/7');

    const deleteButton = await screen.findByRole('button', { name: 'Delete note' });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    await user.click(deleteButton);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: /^Delete$/ }));

    await waitFor(() => expect(document.title).toBe('Notes · Notare'));

    const row = await noteRepository.getByLocalId('local-7');
    expect(row?.deleted).toBe(1);
  });

  // The whole reason this button was worth touching at all: a note that has
  // never reached the server (Step 7's /notes/local/:localId) still needs a
  // way into the trash, same as any other note.
  it('trashes a local-only note that has no serverId yet', async () => {
    await seedNotes(
      makeRow({ serverId: null, localId: 'local-offline', clientId: 'local-offline' }),
    );

    const user = userEvent.setup();
    renderAt('/notes/local/local-offline');

    const deleteButton = await screen.findByRole('button', { name: 'Delete note' });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    await user.click(deleteButton);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: /^Delete$/ }));

    await waitFor(() => expect(document.title).toBe('Notes · Notare'));

    const row = await noteRepository.getByLocalId('local-offline');
    expect(row?.deleted).toBe(1);
  });
});

/*
 * Step 1's addition to the folders panel — see AppLayout.tsx's own doc
 * comments on why the panel's actual contents (Archived/Trash/Voice/
 * Shared with me/Account) don't include Notifications, unlike its stale
 * pre-Step-1 comments once claimed.
 */
describe('the folders panel — Shared with me', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('links to /shared, positioned between Voice notes and Collaborations', async () => {
    const user = userEvent.setup();
    renderAt('/notes');

    await user.click(await screen.findByRole('button', { name: 'Show folders' }));

    const folders = screen.getByRole('navigation', { name: 'Folders' });
    const linkNames = within(folders)
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(linkNames).toEqual([
      'Voice notes',
      'Shared with me',
      'Collaborations',
      'Archived',
      'Trash',
      'Accounts',
    ]);

    expect(within(folders).getByRole('link', { name: 'Shared with me' })).toHaveAttribute(
      'href',
      '/shared',
    );

    expect(within(folders).getByRole('link', { name: 'Collaborations' })).toHaveAttribute(
      'href',
      '/collaborations',
    );
  });

  it('navigates to the Collaboration page', async () => {
    const user = userEvent.setup();
    renderAt('/archived');

    await user.click(await screen.findByRole('button', { name: 'Show folders' }));

    // Scoped to the folders panel, same as the sibling test above — the
    // compact nav (Step 5 of the responsive layout plan) renders its own
    // "Collaborations" link too, and with no breakpoint CSS gating them
    // apart yet (that's Step 6), both are simultaneously in the DOM here.
    // Unscoped, "Collaborations" is now ambiguous between the two.
    const folders = screen.getByRole('navigation', { name: 'Folders' });
    await user.click(within(folders).getByRole('link', { name: 'Collaborations' }));

    expect(await screen.findByRole('heading', { name: 'Collaborations' })).toBeInTheDocument();
  });
});

/*
 * Step 5's addition to .app-shell__nav (responsive layout plan) — the
 * compact nav (icon rail 640-1023px, bottom bar below 640px; no
 * breakpoint-scoped CSS exists yet, so it renders unconditionally here,
 * same as jsdom has no viewport to gate it by regardless) mirrors the
 * folders panel's six destinations exactly, via the same compactNavItems /
 * foldersNavItems alias — see AppLayout.tsx's own comment on that constant.
 */
describe('the compact nav', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders all six destinations with the same names and hrefs as the folders panel', async () => {
    renderAt('/notes');

    const compactNav = await screen.findByRole('list', { name: 'Primary navigation' });
    const linkNames = within(compactNav)
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(linkNames).toEqual([
      'Voice notes',
      'Shared with me',
      'Collaborations',
      'Archived',
      'Trash',
      'Accounts',
    ]);

    expect(within(compactNav).getByRole('link', { name: 'Shared with me' })).toHaveAttribute(
      'href',
      '/shared',
    );
    expect(within(compactNav).getByRole('link', { name: 'Collaborations' })).toHaveAttribute(
      'href',
      '/collaborations',
    );
  });
});

/*
 * The sidebar note list's own right-click / two-finger-trackpad-click /
 * long-press context menu. `fireEvent.contextMenu` stands in for all three
 * gestures here — they all raise the identical native `contextmenu` DOM
 * event (SidebarNoteItem's own comment explains why this component treats
 * them as one), so there is nothing gesture-specific left to test per input
 * device once that event fires correctly.
 */
describe('the sidebar note context menu', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  function openContextMenu(localId: string) {
    const row = document.querySelector(`[data-sidebar-note-id="${localId}"]`);
    if (!row) throw new Error(`No sidebar row found for localId ${localId}`);
    fireEvent.contextMenu(row);
  }

  /*
   * serverId 101/102, deliberately NOT 1/2 — the global `GET /notes`
   * handler (tests/msw/handlers.ts) always answers with fixture notes at
   * ids 1 and 2, content "Body text.". useSync mounts unconditionally in
   * AppLayout and pulls on mount; for a row the PULL response also
   * describes, a clean (non-dirty) local row is treated as safe to
   * overwrite with the server's copy (noteRepository.upsertFromServer's own
   * doc comment). Seeding at id 1 raced that pull replacing this test's
   * "Grocery list" content with the fixture's "Body text." moments after
   * mount — passing or failing per test depending on exactly how much
   * other work (userEvent.setup(), extra interactions) delayed the
   * assertion past that overwrite. 101/102 sit outside the pull response
   * entirely, so nothing here touches them, the same reason the
   * pre-existing "trashes the open server-backed note" test above seeds at
   * serverId 7 rather than 1.
   *
   * That alone isn't quite enough, though: the note DETAIL page also fires
   * its own "refresh this note from the server" GET /notes/:noteId once it
   * mounts, and the global handler for THAT answers any id with the same
   * generic "Body text." content, regardless of which id was asked for. For
   * a clean (dirty:0) seeded row that refetch is a legitimate overwrite by
   * the app's own design, so it silently clobbers whatever content this
   * test seeded a few hundred ms after mount. seedAndStub seeds the rows
   * AND registers per-test overrides so /notes returns no phantom notes and
   * /notes/:noteId echoes back each row's own seeded content instead.
   */
  async function seedAndStub(...rows: NoteRow[]) {
    await seedNotes(...rows);

    const byServerId = new Map(
      rows.filter((row) => row.serverId !== null).map((row) => [row.serverId, row]),
    );

    server.use(
      http.get(`${BASE}/notes`, () => HttpResponse.json(makePage([]))),
      http.get(`${BASE}/notes/:noteId`, ({ params }) => {
        const id = Number(params['noteId']);
        const row = byServerId.get(id);
        return HttpResponse.json(
          makeNote({
            id,
            content: row?.content ?? 'Body text.',
            pinned: row ? row.pinned === 1 : false,
            archived: row ? row.archived === 1 : false,
            version: row?.version ?? 0,
          }),
        );
      }),
    );
  }

  it('opens with every action for the right-clicked note', async () => {
    await seedAndStub(makeRow({ serverId: 101, localId: 'local-101', content: 'Grocery list' }));
    renderAt('/notes/101');

    // Scoped to the sidebar row's own title span — the note's content also
    // renders verbatim in the open editor pane, and an unscoped findByText
    // matches both once the editor finishes loading, which is exactly the
    // "Found multiple elements" failure this selector avoids.
    await screen.findByText('Grocery list', { selector: '.sidebar-note-item__title' });
    openContextMenu('local-101');

    expect(await screen.findByRole('menu', { name: 'Actions for Grocery list' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Share note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Pin note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Archive note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('closes on Escape without changing anything', async () => {
    await seedAndStub(makeRow({ serverId: 101, localId: 'local-101', content: 'Grocery list' }));
    const user = userEvent.setup();
    renderAt('/notes/101');

    // Scoped to the sidebar row's own title span — the note's content also
    // renders verbatim in the open editor pane, and an unscoped findByText
    // matches both once the editor finishes loading, which is exactly the
    // "Found multiple elements" failure this selector avoids.
    await screen.findByText('Grocery list', { selector: '.sidebar-note-item__title' });
    openContextMenu('local-101');
    await screen.findByRole('menu');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('pins the note it was opened for', async () => {
    await seedAndStub(
      makeRow({ serverId: 101, localId: 'local-101', content: 'Grocery list', pinned: 0 }),
    );
    const user = userEvent.setup();
    renderAt('/notes/101');

    // Scoped to the sidebar row's own title span — the note's content also
    // renders verbatim in the open editor pane, and an unscoped findByText
    // matches both once the editor finishes loading, which is exactly the
    // "Found multiple elements" failure this selector avoids.
    await screen.findByText('Grocery list', { selector: '.sidebar-note-item__title' });
    openContextMenu('local-101');
    await user.click(await screen.findByRole('menuitem', { name: 'Pin note' }));

    await waitFor(async () => {
      const row = await noteRepository.getByLocalId('local-101');
      expect(row?.pinned).toBe(1);
    });
  });

  it('archives the note it was opened for and removes it from the active list', async () => {
    server.use(
      http.post(`${BASE}/notes/:noteId/archive`, ({ params }) =>
        HttpResponse.json(makeNote({ id: Number(params['noteId']), archived: true, version: 1 })),
      ),
    );

    await seedAndStub(
      makeRow({ serverId: 101, localId: 'local-101', content: 'Grocery list' }),
      makeRow({ serverId: 102, localId: 'local-102', content: 'Second note' }),
    );
    const user = userEvent.setup();
    renderAt('/notes/102');

    // Scoped to the sidebar row's own title span — the note's content also
    // renders verbatim in the open editor pane, and an unscoped findByText
    // matches both once the editor finishes loading, which is exactly the
    // "Found multiple elements" failure this selector avoids.
    await screen.findByText('Grocery list', { selector: '.sidebar-note-item__title' });
    openContextMenu('local-101');
    await user.click(await screen.findByRole('menuitem', { name: 'Archive note' }));

    await waitFor(async () => {
      const row = await noteRepository.getByLocalId('local-101');
      expect(row?.archived).toBe(1);
    });

    // Archived notes drop out of the live "active notes" query the sidebar
    // renders — same list useNotes() (default archived: false) already
    // backs everywhere else.
    await waitFor(() => {
      expect(screen.queryByText('Grocery list')).not.toBeInTheDocument();
    });
  });

  it('deletes the note it was opened for via the confirm dialog, without navigating away from a DIFFERENT open note', async () => {
    await seedAndStub(
      makeRow({ serverId: 101, localId: 'local-101', content: 'Grocery list' }),
      makeRow({ serverId: 102, localId: 'local-102', content: 'Second note' }),
    );
    const user = userEvent.setup();
    renderAt('/notes/102');

    // Scoped to the sidebar row's own title span — the note's content also
    // renders verbatim in the open editor pane, and an unscoped findByText
    // matches both once the editor finishes loading, which is exactly the
    // "Found multiple elements" failure this selector avoids.
    await screen.findByText('Grocery list', { selector: '.sidebar-note-item__title' });
    openContextMenu('local-101');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    await user.click(await screen.findByRole('button', { name: /^Delete$/ }));

    await waitFor(async () => {
      const row = await noteRepository.getByLocalId('local-101');
      expect(row?.deleted).toBe(1);
    });

    // Note 102 (the note actually open) must still be showing — deleting a
    // DIFFERENT row from the sidebar must never bounce the user off the note
    // they're reading. Asserted via the editor's own content rather than
    // `window.location.pathname`, which createMemoryRouter never touches —
    // the browser's real location stays put regardless of in-memory
    // navigation, so checking it proves nothing either way.
    expect(await screen.findByRole('textbox', { name: 'Note content' })).toHaveValue(
      'Second note',
    );
  });

  it('duplicates the note it was opened for into a new note with the same content', async () => {
    await seedAndStub(makeRow({ serverId: 101, localId: 'local-101', content: 'Grocery list' }));
    const user = userEvent.setup();
    renderAt('/notes/101');

    // Scoped to the sidebar row's own title span — the note's content also
    // renders verbatim in the open editor pane, and an unscoped findByText
    // matches both once the editor finishes loading, which is exactly the
    // "Found multiple elements" failure this selector avoids.
    await screen.findByText('Grocery list', { selector: '.sidebar-note-item__title' });
    openContextMenu('local-101');
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate note' }));

    await waitFor(async () => {
      const outbox = await outboxRepository.list();
      expect(outbox.some((entry) => entry.type === 'CREATE' && entry.content === 'Grocery list')).toBe(
        true,
      );
    });
  });

  it('creates a new blank note from the New note item', async () => {
    await seedAndStub(makeRow({ serverId: 101, localId: 'local-101', content: 'Grocery list' }));
    const user = userEvent.setup();
    renderAt('/notes/101');

    // Scoped to the sidebar row's own title span — the note's content also
    // renders verbatim in the open editor pane, and an unscoped findByText
    // matches both once the editor finishes loading, which is exactly the
    // "Found multiple elements" failure this selector avoids.
    await screen.findByText('Grocery list', { selector: '.sidebar-note-item__title' });
    openContextMenu('local-101');
    await user.click(await screen.findByRole('menuitem', { name: 'New note' }));

    await waitFor(async () => {
      const notes = await noteRepository.listActive(1);
      expect(notes).toHaveLength(2);
    });
  });
});
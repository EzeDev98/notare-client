import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/router';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { makeRow } from '~/fixtures/notes';
import { resetDatabase, seedNotes, SignedIn } from '~/harness';

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
    await seedNotes(makeRow({ serverId: 7, localId: 'local-7', title: 'Meeting notes' }));

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
    await user.click(screen.getByRole('link', { name: 'Collaborations' }));

    expect(await screen.findByRole('heading', { name: 'Collaborations' })).toBeInTheDocument();
  });
});

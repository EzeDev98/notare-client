import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { SearchPage } from '@/pages/Search/Search';
import { makeRow } from '~/fixtures/notes';
import { SignedIn, resetDatabase, seedNotes } from '~/harness';

function renderSearch(path = '/search') {
  const router = createMemoryRouter(
    [
      { path: '/search', element: <SearchPage /> },
      { path: '/notes/:noteId', element: <h1>A note</h1> },
    ],
    { initialEntries: [path] },
  );

  return render(
    <SignedIn>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SignedIn>,
  );
}

describe('searching', () => {
  it('prompts rather than listing everything before a term is entered', async () => {
    await resetDatabase();
    await seedNotes(makeRow({ content: 'Meeting notes' }));

    renderSearch();
    await screen.findByRole('heading', { name: /search/i });

    expect(screen.getByText(/search across the contents/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /meeting notes/i })).not.toBeInTheDocument();
  });

  it('runs a search from a term in the URL', async () => {
    await resetDatabase();
    await seedNotes(makeRow({ content: 'Meeting notes' }));

    renderSearch('/search?q=meeting');

    expect(await screen.findByRole('link', { name: /meeting notes/i })).toBeInTheDocument();
  });

  it('matches on content beyond the label', async () => {
    await resetDatabase();
    await seedNotes(makeRow({ content: 'Groceries\ndiscuss budget in the meeting' }));

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'meeting');
    expect(await screen.findByRole('link', { name: /groceries/i })).toBeInTheDocument();
  });

  it('reports the result count for a screen reader', async () => {
    await resetDatabase();
    await seedNotes(makeRow({ content: 'Meeting notes' }));

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'meeting');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/1 note match/i);
    });
  });

  it('says nothing matched, without pretending the search failed', async () => {
    await resetDatabase();

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'zzzz');

    expect(await screen.findByText(/no notes match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('offers real actions, since a result is now a real local row', async () => {
    await resetDatabase();
    await seedNotes(makeRow({ content: 'Meeting notes', pinned: 0 }));

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'meeting');

    const pinButton = await screen.findByRole('button', { name: /pin meeting notes/i });
    await user.click(pinButton);

    expect(await screen.findByRole('button', { name: /unpin meeting notes/i })).toBeInTheDocument();
  });

  it('drops a result from the list once it is deleted from here', async () => {
    await resetDatabase();
    await seedNotes(makeRow({ content: 'Meeting notes' }));

    const user = userEvent.setup();
    renderSearch();

    await user.type(await screen.findByLabelText(/search your notes/i), 'meeting');
    await screen.findByRole('link', { name: /meeting notes/i });

    await user.click(screen.getByRole('button', { name: /delete meeting notes/i }));

    const deleteModal = await screen.findByRole('dialog');
    expect(deleteModal).toBeInTheDocument();

    await user.click(
      within(deleteModal).getByRole('button', { name: /^Delete$/i }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /meeting notes/i })).not.toBeInTheDocument();
    });
  });
});

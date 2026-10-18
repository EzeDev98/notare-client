import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { NotFoundPage } from '@/pages/NotFound/NotFound';

describe('NotFoundPage', () => {
  /*
   * The screen reads the theme (for the logo) and navigates with useNavigate,
   * so it needs ThemeProvider and a real router with a /notes route to land on.
   *
   * Queried by ROLE and by the text a user would read, not by class name or
   * component internals, so this survives restyling and fails if the page
   * stops telling the user what happened.
   */
  it('tells the user the page was not found and offers a way back', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        { path: '/nowhere', element: <NotFoundPage /> },
        { path: '/notes', element: <h1>Notes</h1> },
      ],
      { initialEntries: ['/nowhere'] },
    );

    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to notes/i }));

    expect(await screen.findByRole('heading', { name: /notes/i })).toBeInTheDocument();
  });
});

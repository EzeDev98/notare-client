import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { NotFoundPage } from '@/pages/NotFound/NotFound';

describe('NotFoundPage', () => {
  /*
   * MemoryRouter because the page renders a <Link>, which needs router
   * context. In-memory history rather than the browser's — a test should not
   * depend on a URL bar existing.
   *
   * Queried by ROLE and by the text a user would read, not by class name or
   * component internals. Behaviour-oriented, per §41: this test survives the
   * page being restyled in Step 2 and fails if the page stops telling the user
   * what happened.
   */
  it('tells the user the page was not found and offers a way back', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to your notes/i })).toHaveAttribute(
      'href',
      '/notes',
    );
  });
});

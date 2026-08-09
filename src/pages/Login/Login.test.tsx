import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoginPage } from '@/pages/Login/Login';
import { expectNoAxeViolations } from '~/a11y';

describe('LoginPage', () => {
  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<LoginPage />);
    await expectNoAxeViolations(container);
  });

  it('labels every field, so a screen reader announces what it is', () => {
    render(<LoginPage />);

    /*
     * getByLabelText resolves the ACCESSIBLE NAME the same way a screen reader
     * does — through <label for>, aria-label or aria-labelledby. It is not a
     * text search: a visible label not associated with its input fails this
     * test, which is exactly the bug worth catching, and exactly the bug you
     * cannot see.
     */
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});

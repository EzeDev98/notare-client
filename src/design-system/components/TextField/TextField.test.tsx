import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TextField } from '@/design-system/components/TextField/TextField';
import { expectNoAxeViolations } from '~/a11y';

describe('TextField', () => {
  it('associates an error with the input, so it is announced and not just seen', async () => {
    const { container } = render(<TextField label="Email" error="Enter a valid email address." />);

    const input = screen.getByLabelText('Email');

    // Two halves of one message: aria-invalid announces the STATE,
    // aria-describedby announces the TEXT. Either alone leaves the user
    // knowing something is wrong but not what, or the reverse.
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // No leading ⚠ here, and that is correct: the icon is aria-hidden in
    // Field.tsx, so it is excluded from the accessible description. It exists
    // for sighted users who cannot rely on colour alone (§36); announcing
    // "warning sign" to a screen reader would be noise on top of aria-invalid.
    expect(input).toHaveAccessibleDescription('Enter a valid email address.');

    await expectNoAxeViolations(container);
  });

  it('describes the input with the hint when there is no error', () => {
    render(<TextField label="Username" hint="Letters and numbers only." />);
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(
      'Letters and numbers only.',
    );
  });

  it('has no description when there is neither hint nor error', () => {
    render(<TextField label="Plain" />);

    // aria-describedby="" is a dangling reference some screen readers announce
    // as an empty description — hence undefined rather than an empty string.
    expect(screen.getByLabelText('Plain')).not.toHaveAttribute('aria-describedby');
  });
});

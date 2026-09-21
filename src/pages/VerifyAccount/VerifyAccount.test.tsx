import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { VerifyAccountPage } from '@/pages/VerifyAccount/VerifyAccount';
import { expectNoAxeViolations } from '~/a11y';

function renderVerify(state?: unknown) {
  const router = createMemoryRouter(
    [
      { path: '/verify', element: <VerifyAccountPage /> },
      { path: '/login', element: <h1>Sign in</h1> },
    ],
    { initialEntries: [{ pathname: '/verify', state }] },
  );
  return render(<RouterProvider router={router} />);
}

describe('check your email', () => {
  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderVerify({ identifier: 'new@example.com' });
    await screen.findByRole('heading', { name: /check your email/i });
    await expectNoAxeViolations(container);
  });

  it('tells the user which address the link was sent to', async () => {
    renderVerify({ identifier: 'new@example.com' });
    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
  });

  it('does not show the address when given a Notarian ID', async () => {
    renderVerify({ identifier: 'HIJKLMN' });
    expect(await screen.findByText(/email address on your account/i)).toBeInTheDocument();
    expect(screen.queryByText('HIJKLMN')).not.toBeInTheDocument();
  });

  it('has no code entry, since verification happens through the emailed link', async () => {
    renderVerify({ identifier: 'new@example.com' });
    await screen.findByRole('heading', { name: /check your email/i });
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });

  it('sends the user to sign in', async () => {
    const user = userEvent.setup();
    renderVerify({ identifier: 'new@example.com' });

    await user.click(await screen.findByRole('button', { name: /go to sign in/i }));

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('asks for the identifier when there is no router state, as after a reload', async () => {
    renderVerify();
    expect(await screen.findByLabelText(/email or notarian id/i)).toHaveValue('');
  });

  it('runs its own resend cooldown, since the server never reports one', async () => {
    const user = userEvent.setup();
    renderVerify({ identifier: 'new@example.com' });

    await user.click(await screen.findByRole('button', { name: /send the email again/i }));

    // The server always answers 200, so the client owns the visible cooldown.
    expect(await screen.findByRole('button', { name: /resend in \d+s/i })).toBeDisabled();
  });
});

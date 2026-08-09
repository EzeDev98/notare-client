import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { VerifyAccountPage } from '@/pages/VerifyAccount/VerifyAccount';
import { expectNoAxeViolations } from '~/a11y';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

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

describe('verification', () => {
  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderVerify();
    await screen.findByRole('heading', { name: /verify/i });
    await expectNoAxeViolations(container);
  });

  it('prefills the identifier from router state', async () => {
    renderVerify({ identifier: 'new@example.com' });
    expect(await screen.findByLabelText(/email or notarian id/i)).toHaveValue('new@example.com');
  });

  it('stays usable with NO router state, as after a reload', async () => {
    /*
     * The reason the identifier is a visible field rather than a hidden value
     * carried from registration. State does not survive a reload, and before
     * B6 the only accepted identifier was a notarianId shown once in a
     * response body — losing it made the account permanently unreachable.
     */
    const user = userEvent.setup();
    renderVerify();

    const field = await screen.findByLabelText(/email or notarian id/i);
    expect(field).toHaveValue('');

    await user.type(field, 'new@example.com');
    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('offers the code to mobile autofill', async () => {
    renderVerify();

    // one-time-code is what puts the emailed code above the keyboard on iOS
    // and Android, removing the app-switch-and-memorise step.
    expect(await screen.findByLabelText(/verification code/i)).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
  });

  it('gives one message for a wrong code and an unknown account alike', async () => {
    server.use(
      http.post(`${BASE}/otp/verify-otp`, () =>
        HttpResponse.json(
          { title: 'Bad Request', status: 400, detail: 'Invalid or expired code.' },
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    const user = userEvent.setup();
    renderVerify({ identifier: 'nobody@example.com' });

    await user.type(await screen.findByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    // Matching the server, which conflates them so this cannot become a
    // registered-address oracle.
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or has expired/i);
  });

  it('runs its own resend cooldown, since the server no longer reports one', async () => {
    const user = userEvent.setup();
    renderVerify({ identifier: 'new@example.com' });

    await user.click(await screen.findByRole('button', { name: /send a new code/i }));

    /*
     * B6 made the server swallow OtpResendCooldownException and always answer
     * 200 — 200-then-429 versus 200-twice was an oracle in two requests. So
     * nothing in the response mentions a cooldown and the client owns it.
     */
    expect(await screen.findByRole('button', { name: /resend in \d+s/i })).toBeDisabled();
  });
});

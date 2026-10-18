import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { AuthProvider } from '@/app/providers/AuthProvider';
import { ROUTES } from '@/app/routes';
import { RequireAuth } from '@/app/RequireAuth';
import { LoginPage } from '@/pages/Login/Login';
import { ERRORS, LOGIN_FIELD_ERRORS } from '@/features/auth/authContent';
import { clearSession, resetTokenStoreForTests } from '@/features/auth/tokenStore';
import { resetRefreshCoordinatorForTests } from '@/features/auth/refreshCoordinator';
import { expectNoAxeViolations } from '~/a11y';
import { problemDetail } from '~/fixtures/errors';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderApp(initialPath = ROUTES.signIn()) {
  const router = createMemoryRouter(
    [
      { path: ROUTES.signIn(), element: <LoginPage /> },
      // 4F: an unverified account is routed here rather than shown a message.
      { path: '/verify', element: <h1>Verify your account</h1> },
      {
        element: <RequireAuth />,
        children: [{ path: '/notes', element: <h1>Notes</h1> }],
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

beforeEach(async () => {
  resetRefreshCoordinatorForTests();
  resetTokenStoreForTests();
  await clearSession();
});

describe('the login form', () => {
  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderApp();
    await screen.findByRole('heading', { name: /sign in/i });
    await expectNoAxeViolations(container);
  });

  it('validates on submit rather than while typing', async () => {
    const user = userEvent.setup();
    renderApp();

    const field = await screen.findByLabelText(/username or email/i);
    await user.type(field, 'te');

    // Nothing yet — telling someone their input is wrong at the second
    // character is hostile.
    expect(screen.queryByText(LOGIN_FIELD_ERRORS.identifierRequired)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter your password/i)).toBeInTheDocument();
  });

  it('signs in and lands on the app', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(await screen.findByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Passw0rd');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('heading', { name: 'Notes' })).toBeInTheDocument();
  });

  it('gives one message for bad credentials, naming neither field', async () => {
    server.use(
      http.post(`${BASE}/login/login`, () =>
        problemDetail(401, { title: 'Unauthorized', detail: 'Invalid credentials.' }),
      ),
    );

    const user = userEvent.setup();
    renderApp();

    await user.type(await screen.findByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    /*
     * "Incorrect username or password", not "no such user". The server does
     * not distinguish them and should not — a form that says which was wrong
     * is an account-enumeration oracle.
     */
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/incorrect username or password/i);
  });

  it('explains an unverified account and offers to check email', async () => {
    // DisabledException: the account exists and the password was right.
    server.use(
      http.post(`${BASE}/login/login`, () =>
        problemDetail(403, { title: 'Forbidden', detail: 'Please verify your email address.' }),
      ),
    );

    const user = userEvent.setup();
    renderApp();

    await user.type(await screen.findByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Passw0rd');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Told what happened, with a button that does the next step.
    expect(await screen.findByText(ERRORS.notVerified)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ERRORS.notVerifiedAction }));
    expect(
      await screen.findByRole('heading', { name: /verify your account/i }),
    ).toBeInTheDocument();
  });

  it('says an administratively locked account is unavailable', async () => {
    server.use(
      http.post(`${BASE}/login/login`, () =>
        problemDetail(423, { title: 'Locked', detail: 'Account locked.' }),
      ),
    );

    const user = userEvent.setup();
    renderApp();

    await user.type(await screen.findByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Passw0rd');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(ERRORS.accountUnavailable);
  });
});

describe('the guard', () => {
  it('sends an unauthenticated visitor to login', async () => {
    renderApp('/notes');

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('returns them to where they were going after signing in', async () => {
    const user = userEvent.setup();
    renderApp('/notes');

    await user.type(await screen.findByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Passw0rd');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Not the default destination by luck — the guard stashed /notes in
    // location.state and login read it back.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    });
  });
});

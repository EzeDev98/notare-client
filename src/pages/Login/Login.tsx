import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { Button } from '@/design-system/components/Button/Button';
import { TextField } from '@/design-system/components/TextField/TextField';
import { fieldErrors, isForbidden, isOffline, isUnauthorized } from '@/lib/http/errors';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Login.css';

const DEFAULT_DESTINATION = '/notes';

/**
 * Reads the intended destination from router state.
 *
 * location.state is typed `any` by React Router, so narrowing is required
 * rather than optional.
 *
 * The startsWith('/') check is an OPEN REDIRECT guard. It is not strictly
 * needed today — this value comes from RequireAuth, not from user input — but
 * the moment anyone adds `?next=` to the login URL, an unvalidated redirect
 * sends users to https://evil.example with our own login page as the referrer.
 * One line now, and the habit costs nothing.
 */
function readDestination(state: unknown): string {
  if (typeof state !== 'object' || state === null) return DEFAULT_DESTINATION;

  const from: unknown = (state as { from?: unknown }).from;
  if (typeof from !== 'string') return DEFAULT_DESTINATION;

  // Must be a path on this origin. "//evil.example" is a protocol-relative
  // URL and starts with "/", so the second character matters too.
  return from.startsWith('/') && !from.startsWith('//') ? from : DEFAULT_DESTINATION;
}

export function LoginPage() {
  useDocumentTitle('Sign in');

  const { state: authState, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /*
   * Already signed in — someone navigated to /login with a live session.
   * Rendered as a redirect rather than handled in an effect: this is a
   * conclusion about the current state, not a side effect of one.
   */
  if (authState.status === 'authenticated' || authState.status === 'refreshing') {
    return <Navigate to={readDestination(location.state)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    // Without this the browser navigates and reloads the whole app.
    event.preventDefault();

    /*
     * Validated on SUBMIT, not on every keystroke. Telling someone their email
     * is invalid while they are typing the third character is hostile. Errors
     * clear as they fix a field, but never appear as they type it.
     */
    const nextErrors: Record<string, string> = {};
    if (usernameOrEmail.trim() === '') {
      nextErrors['usernameOrEmail'] = 'Enter your username or email address.';
    }
    if (password === '') {
      nextErrors['password'] = 'Enter your password.';
    }

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ usernameOrEmail: usernameOrEmail.trim(), password });

      /*
       * Navigate HERE, in the handler — not in an effect keyed on auth state.
       * An effect would cost a second render pass and another piece of state
       * to reason about, for something that is simply the next step of an
       * action the user took.
       */
      void navigate(readDestination(location.state), { replace: true });
    } catch (error) {
      if (isUnauthorized(error)) {
        /*
         * ONE message for both fields, deliberately. The server does not say
         * which was wrong, and it should not — "no such user" versus "wrong
         * password" turns a login form into an account-enumeration oracle.
         */
        setFormError('Incorrect username or password.');
      } else if (isForbidden(error)) {
        /*
         * NOT a permission problem. DisabledException: the account exists, the
         * password was right, and it is unverified. Showing "you do not have
         * permission" here would be actively misleading — the user needs the
         * code in their inbox.
         *
         * The verification screen arrives in 4F; until then this at least says
         * something true.
         */
        setFormError('Please verify your email address before signing in.');
      } else if (isOffline(error)) {
        setFormError('Cannot reach Notare. Check your connection and try again.');
      } else {
        // Field errors, if the server sent any (B2's validation handler).
        const serverFields = fieldErrors(error);
        if (serverFields) {
          setErrors(serverFields);
        } else {
          setFormError('Something went wrong. Please try again.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>Sign in</h1>

      {authState.status === 'session-expired' ? (
        <p className="login__notice" role="status">
          {authState.reason === 'revoked'
            ? 'This session was signed out from another device.'
            : 'Your session expired. Please sign in again.'}
        </p>
      ) : null}

      {/*
        A real <form>, not a div with a click handler. Enter submits, password
        managers offer to fill and save, and screen readers announce it as a
        form. All free, and all absent from a div.
      */}
      <form className="login__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {formError !== null ? (
          // role="alert" so it is announced when it appears, rather than being
          // a red sentence only sighted users discover.
          <p className="login__error" role="alert">
            {formError}
          </p>
        ) : null}

        <TextField
          label="Username or email"
          // Tells a password manager which field is which. Without it, saved
          // credentials frequently do not offer at all.
          autoComplete="username"
          value={usernameOrEmail}
          error={errors['usernameOrEmail'] || undefined}
          onChange={(event) => {
            setUsernameOrEmail(event.target.value);
            // Clear as they fix it.
            setErrors((current) => ({ ...current, usernameOrEmail: '' }));
          }}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={errors['password'] || undefined}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: '' }));
          }}
        />

        {/*
          type="submit" explicitly. 2D made Button default to type="button" to
          prevent ACCIDENTAL submission, which means deliberate submission is
          now opt-in — exactly the right way round.
        */}
        <Button type="submit" variant="primary" loading={submitting}>
          Sign in
        </Button>
      </form>
    </>
  );
}

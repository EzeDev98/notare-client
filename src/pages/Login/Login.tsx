import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { Button } from '@/design-system/components/Button/Button';
import { FormAlert } from '@/design-system/components/FormAlert/FormAlert';
import { PasswordField } from '@/design-system/components/PasswordField/PasswordField';
import { TextField } from '@/design-system/components/TextField/TextField';
import { fieldErrors, isForbidden, isOffline, isUnauthorized, statusOf } from '@/lib/http/errors';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Login.css';

const DEFAULT_DESTINATION = '/notes';

/** True when we arrived here straight after verifying an account. */
function readVerified(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false;
  return (state as { verified?: unknown }).verified === true;
}

function readDestination(): string {
  return DEFAULT_DESTINATION;
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
    return <Navigate to={readDestination()} replace />;
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
      void navigate(readDestination(), { replace: true });
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
         * Now actionable. The account exists and the password was right — it
         * is simply unverified, so send them where they can fix it, carrying
         * the identifier so they do not retype it.
         */
        void navigate('/verify', { state: { identifier: usernameOrEmail.trim() } });
        return;
      } else if (statusOf(error) === 423) {
        // Locked or disabled by an administrator: nothing the user can fix here.
        setFormError('This account is unavailable. Please contact support.');
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
      <h1 className="public-shell__heading">Sign in</h1>
      <p className="public-shell__subtitle">Sign in to your account</p>

      {authState.status === 'session-expired' ? (
        <FormAlert variant="info" role="status">
          {authState.reason === 'revoked'
            ? 'This session was signed out from another device.'
            : 'Your session expired. Please sign in again.'}
        </FormAlert>
      ) : null}

      {/*
        A real <form>, not a div with a click handler. Enter submits, password
        managers offer to fill and save, and screen readers announce it as a
        form. All free, and all absent from a div.
      */}
      {readVerified(location.state) ? (
        <FormAlert variant="info" role="status">Your account is verified. Sign in to continue.</FormAlert>
      ) : null}

      <form className="login__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {formError !== null ? (
          // role="alert" so it is announced when it appears, rather than being
          // a red sentence only sighted users discover.
          <FormAlert variant="danger" role="alert">{formError}</FormAlert>
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

        <PasswordField
          label="Password"
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

      <div className="login__links">
        <p>
          <Link to="/reset-password">Forgot your password?</Link>
        </p>

        <p>
          New to Notare? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </>
  );
}

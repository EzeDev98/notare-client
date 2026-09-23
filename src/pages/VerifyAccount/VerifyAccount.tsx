import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useAccountVerification } from '@/features/auth/hooks/useAccountVerification';
import { Button } from '@/design-system/components/Button/Button';
import { FormAlert } from '@/design-system/components/FormAlert/FormAlert';
import { TextField } from '@/design-system/components/TextField/TextField';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './VerifyAccount.css';

const RESEND_COOLDOWN_SECONDS = 60;

/** Prefill from router state, tolerating its absence (e.g. after a reload). */
function readIdentifier(state: unknown): string {
  if (typeof state !== 'object' || state === null) return '';
  const value: unknown = (state as { identifier?: unknown }).identifier;
  return typeof value === 'string' ? value : '';
}

/**
 * Informational only. Verification happens on internal-auth through the link
 * in the email, so there is nothing to type here. Reached after registering,
 * and again when a login is refused because the email is still unverified.
 */
export function VerifyAccountPage() {
  useDocumentTitle('Check your email');

  const location = useLocation();
  const navigate = useNavigate();
  const cooldown = useCountdown();
  const verification = useAccountVerification();

  const initialIdentifier = readIdentifier(location.state);
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [error, setError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const isEmail = initialIdentifier.includes('@');

  async function handleResend(): Promise<void> {
    if (identifier.trim() === '') {
      setError('Enter your email or Notarian ID.');
      return;
    }

    /*
     * The countdown starts BEFORE the request and runs regardless of outcome.
     * The server always answers 200, so nothing in the response can tell us
     * whether an email was actually sent; the client owns the visible cooldown.
     */
    cooldown.start(RESEND_COOLDOWN_SECONDS);
    setNotice('If that account exists and is unverified, a new email is on its way.');

    await verification.resend(identifier.trim());
  }

  return (
    <>
      <h1 className="public-shell__heading">Check your email</h1>
      <p className="public-shell__subtitle">
        {isEmail ? (
          <>
            We&apos;ve sent a verification link to <strong>{initialIdentifier}</strong>.
          </>
        ) : (
          <>We&apos;ve sent a verification link to the email address on your account.</>
        )}{' '}
        Open it to verify your account, then sign in.
      </p>

      <div className="verify__form">
        {notice !== null ? (
          <FormAlert variant="info" role="status">{notice}</FormAlert>
        ) : null}

        <Button
          type="button"
          variant="primary"
          onClick={() => {
            void navigate('/login', { replace: true });
          }}
        >
          Go to sign in
        </Button>

        {/* Only when we lost the identifier (e.g. a reload) — otherwise resend just works. */}
        {initialIdentifier === '' ? (
          <TextField
            label="Email or Notarian ID"
            autoComplete="email"
            value={identifier}
            error={error}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setError(undefined);
            }}
          />
        ) : null}
      </div>

      <div className="verify__links">
        <p>Didn&apos;t get it? Check your spam folder, or</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={cooldown.remaining > 0}
          onClick={() => void handleResend()}
        >
          {cooldown.remaining > 0
            ? `Resend in ${String(cooldown.remaining)}s`
            : 'Send the email again'}
        </Button>

        <p>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </>
  );
}

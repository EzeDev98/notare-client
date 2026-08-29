import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useAccountVerification } from '@/features/auth/hooks/useAccountVerification';
import { validateOtpCode } from '@/features/auth/validation';
import { Button } from '@/design-system/components/Button/Button';
import { TextField } from '@/design-system/components/TextField/TextField';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './VerifyAccount.css';

const RESEND_COOLDOWN_SECONDS = 60;

/** Prefill from router state, tolerating its absence. */
function readIdentifier(state: unknown): string {
  if (typeof state !== 'object' || state === null) return '';
  const value: unknown = (state as { identifier?: unknown }).identifier;
  return typeof value === 'string' ? value : '';
}

export function VerifyAccountPage() {
  useDocumentTitle('Verify your account');

  const location = useLocation();
  const navigate = useNavigate();
  const cooldown = useCountdown();
  const verification = useAccountVerification();

  const [identifier, setIdentifier] = useState(() => readIdentifier(location.state));
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [notice, setNotice] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return errors[field] ?? verification.fieldMessages[field];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const next = {
      identifier: identifier.trim() === '' ? 'Enter your email or Notarian ID.' : undefined,
      code: validateOtpCode(code),
    };
    setErrors(next);
    if (next.identifier !== undefined || next.code !== undefined) return;

    const result = await verification.run(identifier.trim(), code.trim());
    if (result === null) return;

    void navigate('/login', { replace: true, state: { verified: true } });
  }

  async function handleResend(): Promise<void> {
    if (identifier.trim() === '') {
      setErrors({ identifier: 'Enter your email or Notarian ID.' });
      return;
    }

    /*
     * The countdown starts BEFORE the request and runs regardless of outcome.
     *
     * B6 made the server swallow its own cooldown and always answer 200 —
     * 200-then-429 versus 200-twice was a registered-address oracle in two
     * requests. So nothing in the response can tell us whether a code was
     * actually sent, and the client owns the visible cooldown entirely.
     */
    cooldown.start(RESEND_COOLDOWN_SECONDS);
    setNotice('If that account exists and is unverified, a new code is on its way.');

    await verification.resend(identifier.trim());
  }

  return (
    <>
      <h1 className="public-shell__heading">Verify your account</h1>
      <p className="public-shell__subtitle">
        Enter the 6-digit code we emailed you. Codes expire after 10 minutes.
      </p>

      <form className="verify__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {verification.formError !== null ? (
          <p className="verify__error" role="alert">
            {verification.formError}
          </p>
        ) : null}

        {notice !== null ? (
          <p className="verify__notice" role="status">
            {notice}
          </p>
        ) : null}

        {/*
          VISIBLE AND EDITABLE, prefilled from router state when we have it.
          A hidden value carried from registration would break on reload and
          leave the screen with nothing to work from. Since B6 this can be an
          email, so there is nothing the user must have kept.
        */}
        <TextField
          label="Email or Notarian ID"
          autoComplete="email"
          value={identifier}
          error={errorFor('identifier')}
          onChange={(event) => {
            setIdentifier(event.target.value);
            setErrors((current) => ({ ...current, identifier: undefined }));
          }}
        />

        <TextField
          label="Verification code"
          // Numeric keypad on mobile, and one-time-code makes iOS and Android
          // offer the emailed code directly above the keyboard.
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          error={errorFor('code')}
          onChange={(event) => {
            setCode(event.target.value);
            setErrors((current) => ({ ...current, code: undefined }));
          }}
        />

        <Button type="submit" variant="primary" loading={verification.submitting}>
          Verify
        </Button>
      </form>

      {/*
        Step 13. Both footer actions in ONE centred group — previously two
        separate left-aligned blocks (a ghost Button, then a Link below it
        in its own div), which read as misaligned under a centred,
        full-width Verify button. Mirrors Login.tsx's own .login__links.
      */}
      <div className="verify__links">
        <Button
          variant="ghost"
          size="sm"
          disabled={cooldown.remaining > 0}
          onClick={() => void handleResend()}
        >
          {cooldown.remaining > 0 ? `Resend in ${String(cooldown.remaining)}s` : 'Send a new code'}
        </Button>

        <p>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { usePasswordReset } from '@/features/auth/hooks/usePasswordReset';
import {
  validateConfirmation,
  validateEmail,
  validateOtpCode,
  validatePassword,
} from '@/features/auth/validation';
import { Button } from '@/design-system/components/Button/Button';
import { FormAlert } from '@/design-system/components/FormAlert/FormAlert';
import { PasswordField } from '@/design-system/components/PasswordField/PasswordField';
import { TextField } from '@/design-system/components/TextField/TextField';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './ResetPassword.css';
import { ROUTES } from '@/app/routes';

type Step = 'request' | 'verify' | 'complete';

/**
 * The whole reset flow on ONE route, with the step in component state.
 *
 * Three routes would be the obvious structure and has a fatal property: the
 * resetToken from step two has to reach step three, so it travels in router
 * state and is lost on reload. Unlike 4F's identifier, a resetToken CANNOT be
 * retyped — the user would be stuck holding a valid code with no way to spend
 * it.
 *
 * One route does not survive a reload either, but it does not PROMISE to.
 * Reloading restarts the flow honestly rather than landing on a URL that looks
 * addressable and is not.
 */
export function ResetPasswordPage() {
  useDocumentTitle('Reset your password');

  const navigate = useNavigate();
  const reset = usePasswordReset();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function handleRequest(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const emailError = validateEmail(email);
    setErrors({ email: emailError });
    if (emailError !== undefined) return;

    const result = await reset.requestAction.run(email.trim());
    if (result === null) return;

    /*
     * Advances regardless of whether the address is registered — the server
     * answers identically either way, deliberately, and branching here would
     * reintroduce the account-enumeration oracle it exists to prevent.
     */
    setStep('verify');
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const codeError = validateOtpCode(code);
    setErrors({ code: codeError });
    if (codeError !== undefined) return;

    const result = await reset.verifyAction.run(email.trim(), code.trim());
    if (result === null) return;

    reset.setResetToken(result.resetToken);
    setStep('complete');
  }

  async function handleComplete(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const next = {
      password: validatePassword(password),
      confirmation: validateConfirmation(password, confirmation),
    };
    setErrors(next);
    if (next.password !== undefined || next.confirmation !== undefined) return;

    if (reset.resetToken === null) {
      // Only reachable if state was lost — start again rather than fail
      // mysteriously at the server.
      setStep('request');
      return;
    }

    const result = await reset.completeAction.run(reset.resetToken, password);
    if (result === null) return;

    void navigate(ROUTES.signIn(), { replace: true, state: { passwordReset: true } });
  }

  return (
    <>
      <h1 className="public-shell__heading">Reset your password</h1>

      {step === 'request' ? (
        <form className="reset__form" onSubmit={(event) => void handleRequest(event)} noValidate>
          <p className="reset__lead">Enter your email address and we&apos;ll send you a code.</p>

          {reset.requestAction.formError !== null ? (
            <FormAlert variant="danger" role="alert">{reset.requestAction.formError}</FormAlert>
          ) : null}

          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            error={errors['email']}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors({});
            }}
          />

          <Button type="submit" variant="primary" loading={reset.requestAction.submitting}>
            Send code
          </Button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form className="reset__form" onSubmit={(event) => void handleVerify(event)} noValidate>
          {/* Non-committal: the server does not confirm whether the address is
              registered, and neither should this. */}
          <p className="reset__lead" role="status">
            If an account exists for {email}, a code is on its way. Codes expire after 10 minutes.
          </p>

          {reset.verifyAction.formError !== null ? (
            <FormAlert variant="danger" role="alert">{reset.verifyAction.formError}</FormAlert>
          ) : null}

          <TextField
            label="Reset code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            error={errors['code']}
            onChange={(event) => {
              setCode(event.target.value);
              setErrors({});
            }}
          />

          <Button type="submit" variant="primary" loading={reset.verifyAction.submitting}>
            Continue
          </Button>
        </form>
      ) : null}

      {step === 'complete' ? (
        <form className="reset__form" onSubmit={(event) => void handleComplete(event)} noValidate>
          <p className="reset__lead">Choose a new password.</p>

          {reset.completeAction.formError !== null ? (
            <FormAlert variant="danger" role="alert">{reset.completeAction.formError}</FormAlert>
          ) : null}

          <PasswordField
            label="New password"
            autoComplete="new-password"
            hint="At least 8 characters, with an uppercase letter, a lowercase letter and a digit."
            value={password}
            error={errors['password']}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors({});
            }}
          />

          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmation}
            error={errors['confirmation']}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setErrors({});
            }}
          />

          <Button type="submit" variant="primary" loading={reset.completeAction.submitting}>
            Reset password
          </Button>
        </form>
      ) : null}

      <div className="reset__alt">
        <Link to={ROUTES.signIn()}>Back to sign in</Link>
      </div>
    </>
  );
}

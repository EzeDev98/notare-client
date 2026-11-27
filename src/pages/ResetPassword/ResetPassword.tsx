/** Password reset screen. */
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import {
  Button,
  FormScreen,
  InfoBanner,
  OtpField,
  Steps,
  TextField,
  useToast,
} from '@/design-system/ui';
import {
  RESEND_COOLDOWN_SECONDS,
  RESET_CODE,
  RESET_MESSAGES,
  RESET_NEW_PASSWORD,
  RESET_REQUEST,
  TOASTS,
} from '@/features/auth/authContent';
import { usePasswordReset } from '@/features/auth/hooks/usePasswordReset';
import {
  validateConfirmation,
  validateEmail,
  validateOtpCode,
  validatePassword,
} from '@/features/auth/validation';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { NewPasswordFields } from './NewPasswordFields';

type Step = 'request' | 'verify' | 'complete';

const TOTAL_STEPS = 3;
const STEP_NUMBER: Record<Step, number> = { request: 1, verify: 2, complete: 3 };

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const reset = usePasswordReset();
  const cooldown = useCountdown();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  const view =
    step === 'request'
      ? RESET_REQUEST
      : step === 'verify'
        ? { ...RESET_CODE, description: RESET_CODE.description(email.trim()) }
        : RESET_NEW_PASSWORD;
  useDocumentTitle(view.title);

  const busy =
    step === 'request'
      ? reset.requestAction.submitting
      : step === 'verify'
        ? reset.verifyAction.submitting
        : reset.completeAction.submitting;

  const formError = step === 'complete' ? reset.completeAction.formError : reset.requestAction.formError;

  const errorProp = (message: string | undefined | null): { error?: string } =>
    message ? { error: message } : {};

  function handleBack(): void {
    if (step === 'request') {
      void navigate(ROUTES.signIn());
      return;
    }
    reset.setResetToken(null);
    setErrors({});
    setStep('request');
  }

  async function handleRequest(): Promise<void> {
    const emailError = validateEmail(email);
    setErrors({ email: emailError });
    if (emailError !== undefined) {
      emailRef.current?.focus();
      return;
    }

    const result = await reset.requestAction.run(email.trim());
    if (result === null) return;

    cooldown.start(RESEND_COOLDOWN_SECONDS);
    setCode('');
    setStep('verify');
  }

  async function handleVerify(): Promise<void> {
    const codeError = validateOtpCode(code);
    setErrors({ code: codeError });
    if (codeError !== undefined) return;

    const result = await reset.verifyAction.run(email.trim(), code.trim());
    if (result === null) return;

    reset.setResetToken(result.resetToken);
    setStep('complete');
  }

  async function handleComplete(): Promise<void> {
    const found = {
      password: validatePassword(password),
      confirmation: validateConfirmation(password, confirmation),
    };
    setErrors(found);
    if (found.password !== undefined) {
      passwordRef.current?.focus();
      return;
    }
    if (found.confirmation !== undefined) {
      confirmationRef.current?.focus();
      return;
    }

    if (reset.resetToken === null) {
      setStep('request');
      return;
    }

    const result = await reset.completeAction.run(reset.resetToken, password);
    if (result === null) return;

    toast(TOASTS.passwordUpdated, { tone: 'success' });
    void navigate(ROUTES.signIn(), { replace: true });
  }

  async function handleResend(): Promise<void> {
    if (cooldown.remaining > 0 || reset.requestAction.submitting) return;
    const result = await reset.requestAction.run(email.trim());
    if (result === null) return;
    cooldown.start(RESEND_COOLDOWN_SECONDS);
    toast(RESET_MESSAGES.resentToast, { tone: 'success' });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;
    if (step === 'request') void handleRequest();
    else if (step === 'verify') void handleVerify();
    else void handleComplete();
  }

  return (
    <FormScreen
      title={view.title}
      description={view.description}
      step={<Steps current={STEP_NUMBER[step]} total={TOTAL_STEPS} />}
      variant={step === 'verify' ? 'code' : undefined}
      onBack={handleBack}
      onSubmit={handleSubmit}
      footer={
        <>
          {formError !== null ? <InfoBanner tone="error">{formError}</InfoBanner> : null}
          <Button type="submit" variant="primary" block busy={busy}>
            {view.submit}
          </Button>
          {step === 'verify' ? (
            <Button
              variant="ghost"
              block
              disabled={cooldown.remaining > 0}
              onClick={() => void handleResend()}
            >
              {cooldown.remaining > 0 ? RESET_CODE.resendIn(cooldown.remaining) : RESET_CODE.resend}
            </Button>
          ) : null}
        </>
      }
    >
      {step === 'request' ? (
        <TextField
          ref={emailRef}
          label={RESET_REQUEST.labels.email}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          submitting={busy}
          value={email}
          {...errorProp(errors['email'])}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors({});
            reset.requestAction.reset();
          }}
        />
      ) : null}

      {step === 'verify' ? (
        <OtpField
          label={RESET_CODE.otpLabel}
          value={code}
          disabled={busy}
          autoFocus
          {...errorProp(errors['code'] ?? reset.verifyAction.formError)}
          onChange={(value) => {
            setCode(value);
            setErrors({});
            reset.verifyAction.reset();
          }}
        />
      ) : null}

      {step === 'complete' ? (
        <NewPasswordFields
          passwordRef={passwordRef}
          confirmationRef={confirmationRef}
          password={password}
          confirmation={confirmation}
          errors={errors}
          submitting={busy}
          onChange={(field, value) => {
            if (field === 'password') setPassword(value);
            else setConfirmation(value);
            setErrors({});
            reset.completeAction.reset();
          }}
        />
      ) : null}
    </FormScreen>
  );
}

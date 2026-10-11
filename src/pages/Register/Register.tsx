import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { Button, FormScreen, InfoBanner, PasswordField, Steps, TextField } from '@/design-system/ui';
import { REGISTER_ACCOUNT, REGISTER_PERSONAL, REGISTER_STEPS } from '@/features/auth/authContent';
import { useRegistration } from '@/features/auth/hooks/useRegistration';
import {
  validateConfirmation,
  validateEmail,
  validatePassword,
  validateRequiredName,
  validateUsername,
} from '@/features/auth/validation';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

type Step = 1 | 2;
type Field = 'firstName' | 'lastName' | 'username' | 'email' | 'password' | 'confirmPassword';
type Errors = Partial<Record<Field, string | undefined>>;

const STEP_FIELDS: Record<Step, Field[]> = {
  1: ['firstName', 'lastName'],
  2: ['username', 'email', 'password', 'confirmPassword'],
};

export function RegisterPage() {
  const navigate = useNavigate();
  const registration = useRegistration();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Record<Field, string>>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});

  const content = step === 1 ? REGISTER_PERSONAL : REGISTER_ACCOUNT;
  useDocumentTitle(content.title);

  /** Local validation wins over the server's; both clear as the person edits (see update). */
  function errorFor(field: Field): string | undefined {
    return errors[field] ?? registration.fieldMessages[field];
  }

  // exactOptionalPropertyTypes: the field wants no `error` key at all when there is none.
  function fieldError(field: Field): { error?: string } {
    const message = errorFor(field);
    return message ? { error: message } : {};
  }

  function update(field: Field, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    // Errors clear as a field is fixed, never appear while typing.
    setErrors((current) => ({ ...current, [field]: undefined }));
    registration.reset();
  }

  function focusFirstInvalid(found: Errors, forStep: Step): void {
    const first = STEP_FIELDS[forStep].find((field) => found[field] !== undefined);
    if (first) inputs.current[first]?.focus();
  }

  function handleBack(): void {
    if (step === 2) {
      setStep(1);
      return;
    }
    void navigate(ROUTES.welcome());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (registration.submitting) return;

    if (step === 1) {
      const found: Errors = {
        firstName: validateRequiredName(form.firstName, REGISTER_PERSONAL.labels.firstName),
        lastName: validateRequiredName(form.lastName, REGISTER_PERSONAL.labels.lastName),
      };
      setErrors(found);
      if (Object.values(found).some((message) => message !== undefined)) {
        focusFirstInvalid(found, 1);
        return;
      }
      setStep(2);
      return;
    }

    const found: Errors = {
      username: validateUsername(form.username),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirmPassword: validateConfirmation(form.password, form.confirmPassword),
    };
    setErrors(found);
    if (Object.values(found).some((message) => message !== undefined)) {
      focusFirstInvalid(found, 2);
      return;
    }

    const result = await registration.run({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
    });

    // null means it failed; the hook already holds the message to render.
    if (result === null) return;

    // No auto sign-in: the account is unverified. justSent starts the resend cooldown over there.
    void navigate(ROUTES.verify(), {
      replace: true,
      state: { identifier: form.email.trim(), justSent: true },
    });
  }

  return (
    <FormScreen
      title={content.title}
      description={content.description}
      step={<Steps current={step} total={REGISTER_STEPS.total} />}
      onBack={handleBack}
      onSubmit={(event) => void handleSubmit(event)}
      footer={
        <>
          {step === 2 && registration.formError !== null ? (
            <InfoBanner tone="error">{registration.formError}</InfoBanner>
          ) : null}
          <Button type="submit" variant="primary" block busy={registration.submitting}>
            {content.submit}
          </Button>
        </>
      }
    >
      {step === 1 ? (
        <>
          <TextField
            ref={(element) => {
              inputs.current.firstName = element;
            }}
            label={REGISTER_PERSONAL.labels.firstName}
            autoComplete="given-name"
            value={form.firstName}
            {...fieldError('firstName')}
            onChange={(event) => {
              update('firstName', event.target.value);
            }}
          />
          <TextField
            ref={(element) => {
              inputs.current.lastName = element;
            }}
            label={REGISTER_PERSONAL.labels.lastName}
            autoComplete="family-name"
            value={form.lastName}
            {...fieldError('lastName')}
            onChange={(event) => {
              update('lastName', event.target.value);
            }}
          />
        </>
      ) : (
        <>
          <TextField
            ref={(element) => {
              inputs.current.username = element;
            }}
            label={REGISTER_ACCOUNT.labels.username}
            hint={REGISTER_ACCOUNT.hints.username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            submitting={registration.submitting}
            value={form.username}
            {...fieldError('username')}
            onChange={(event) => {
              update('username', event.target.value);
            }}
          />
          <TextField
            ref={(element) => {
              inputs.current.email = element;
            }}
            label={REGISTER_ACCOUNT.labels.email}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            submitting={registration.submitting}
            value={form.email}
            {...fieldError('email')}
            onChange={(event) => {
              update('email', event.target.value);
            }}
          />
          <PasswordField
            ref={(element) => {
              inputs.current.password = element;
            }}
            label={REGISTER_ACCOUNT.labels.password}
            hint={REGISTER_ACCOUNT.hints.password}
            // new-password makes a password manager offer to generate one.
            autoComplete="new-password"
            submitting={registration.submitting}
            value={form.password}
            {...fieldError('password')}
            onChange={(event) => {
              update('password', event.target.value);
            }}
          />
          <PasswordField
            ref={(element) => {
              inputs.current.confirmPassword = element;
            }}
            label={REGISTER_ACCOUNT.labels.confirmPassword}
            autoComplete="new-password"
            submitting={registration.submitting}
            value={form.confirmPassword}
            {...fieldError('confirmPassword')}
            onChange={(event) => {
              update('confirmPassword', event.target.value);
            }}
          />
        </>
      )}
    </FormScreen>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { useRegistration } from '@/features/auth/hooks/useRegistration';
import {
  validateConfirmation,
  validateEmail,
  validatePassword,
  validateRequiredName,
  validateUsername,
} from '@/features/auth/validation';
import { Button } from '@/design-system/components/Button/Button';
import { Select } from '@/design-system/components/Select/Select';
import { TextField } from '@/design-system/components/TextField/TextField';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Register.css';

type Errors = Record<string, string | undefined>;

export function RegisterPage() {
  useDocumentTitle('Create an account');

  const navigate = useNavigate();
  const registration = useRegistration();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    gender: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Errors>({});

  /**
   * Local validation wins over the server's.
   *
   * Two sources, and they are not interchangeable: local messages are current
   * (they reflect what is in the field right now), while server messages
   * describe the values as they were SUBMITTED. After a failed submit the user
   * edits a field, the local error clears — and without this precedence the
   * stale server message would reappear underneath, telling them to fix
   * something they just fixed.
   */
  function errorFor(field: string): string | undefined {
    return errors[field] ?? registration.fieldMessages[field];
  }

  function update(field: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    // Errors clear as the user fixes a field, but never appear while typing.
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    /*
     * Client-side validation MIRRORS the server (features/auth/validation.ts),
     * using its exact message strings. B2 means the server would tell us
     * per-field, so this is about latency rather than capability — a round
     * trip to learn that a password needs a digit is a poor experience for a
     * rule we already know.
     */
    const next: Errors = {
      firstName: validateRequiredName(form.firstName, 'First name'),
      lastName: validateRequiredName(form.lastName, 'Last name'),
      username: validateUsername(form.username),
      email: validateEmail(form.email),
      gender: form.gender === '' ? 'Please select a gender.' : undefined,
      password: validatePassword(form.password),
      confirmPassword: validateConfirmation(form.password, form.confirmPassword),
    };

    setErrors(next);
    if (Object.values(next).some((message) => message !== undefined)) return;

    const result = await registration.run({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      gender: form.gender as 'MALE' | 'FEMALE' | 'OTHER',
      password: form.password,
      confirmPassword: form.confirmPassword,
    });

    // null means it failed; the hook already holds the message to render.
    if (result === null) return;

    /*
     * No auto sign-in: the account is unverified and login would answer 403.
     *
     * The email travels in router state as a CONVENIENCE — the verify screen
     * prefills it and stays fully usable without it. Since B6 the identifier
     * can be an email, so nothing here must survive a reload.
     */
    void navigate('/verify', { replace: true, state: { identifier: form.email.trim() } });
  }

  return (
    <>
      <h1>Create an account</h1>

      <form className="register__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {registration.formError !== null ? (
          <p className="register__error" role="alert">
            {registration.formError}
          </p>
        ) : null}

        <div className="register__row">
          <TextField
            label="First name"
            autoComplete="given-name"
            value={form.firstName}
            error={errorFor('firstName')}
            onChange={(event) => {
              update('firstName', event.target.value);
            }}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            value={form.lastName}
            error={errorFor('lastName')}
            onChange={(event) => {
              update('lastName', event.target.value);
            }}
          />
        </div>

        <TextField
          label="Username"
          autoComplete="username"
          hint="3 to 30 characters."
          value={form.username}
          error={errorFor('username')}
          onChange={(event) => {
            update('username', event.target.value);
          }}
        />

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          error={errorFor('email')}
          onChange={(event) => {
            update('email', event.target.value);
          }}
        />

        <Select
          label="Gender"
          value={form.gender}
          error={errorFor('gender')}
          onChange={(event) => {
            update('gender', event.target.value);
          }}
        >
          {/* Empty first option so nothing is preselected — a defaulted value
              is one the user never chose but appears to have. */}
          <option value="">Select…</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </Select>

        <TextField
          label="Password"
          type="password"
          // new-password, not current-password: this is what makes a password
          // manager offer to GENERATE one rather than fill an existing one.
          autoComplete="new-password"
          hint="At least 8 characters, with an uppercase letter, a lowercase letter and a digit."
          value={form.password}
          error={errorFor('password')}
          onChange={(event) => {
            update('password', event.target.value);
          }}
        />

        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          error={errorFor('confirmPassword')}
          onChange={(event) => {
            update('confirmPassword', event.target.value);
          }}
        />

        <Button type="submit" variant="primary" loading={registration.submitting}>
          Create account
        </Button>
      </form>

      <p className="register__alt">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </>
  );
}

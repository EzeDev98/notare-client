/** The new password and its confirmation on the password reset screen. */
import type { RefObject } from 'react';

import { PasswordField } from '@/design-system/ui';
import { RESET_NEW_PASSWORD } from '@/features/auth/authContent';

type Field = 'password' | 'confirmation';

interface NewPasswordFieldsProps {
  passwordRef: RefObject<HTMLInputElement | null>;
  confirmationRef: RefObject<HTMLInputElement | null>;
  password: string;
  confirmation: string;
  errors: Partial<Record<Field, string | undefined>>;
  submitting: boolean;
  onChange: (field: Field, value: string) => void;
}

const errorProp = (message: string | undefined): { error?: string } =>
  message ? { error: message } : {};

export function NewPasswordFields({
  passwordRef,
  confirmationRef,
  password,
  confirmation,
  errors,
  submitting,
  onChange,
}: NewPasswordFieldsProps) {
  return (
    <>
      <PasswordField
        ref={passwordRef}
        label={RESET_NEW_PASSWORD.labels.password}
        hint={RESET_NEW_PASSWORD.hint}
        autoComplete="new-password"
        submitting={submitting}
        value={password}
        {...errorProp(errors.password)}
        onChange={(event) => {
          onChange('password', event.target.value);
        }}
      />
      <PasswordField
        ref={confirmationRef}
        label={RESET_NEW_PASSWORD.labels.confirmPassword}
        autoComplete="new-password"
        submitting={submitting}
        value={confirmation}
        {...errorProp(errors.confirmation)}
        onChange={(event) => {
          onChange('confirmation', event.target.value);
        }}
      />
    </>
  );
}

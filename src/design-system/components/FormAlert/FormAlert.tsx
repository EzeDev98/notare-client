import type { ReactNode } from 'react';
import { Alert } from '@patternfly/react-core';

interface FormAlertProps {
  /** 'danger' for a submission failure, 'info' for a routine notice. */
  variant: 'danger' | 'info';
  /** 'alert' interrupts (validation/submit failures); 'status' is routine
   * (session notices) and does not steal focus or force an announcement. */
  role: 'alert' | 'status';
  children: ReactNode;
}

/**
 * The inline banner every auth/form page shows for a submission error or a
 * routine notice. Login, Register, Reset password, Verify account and
 * Sessions each carried their own copy of the same CSS for this (a border
 * and colour for an error, a tinted background for a notice) — one
 * PatternFly Alert, `isInline`, replaces all of it.
 */
export function FormAlert({ variant, role, children }: FormAlertProps) {
  return <Alert isInline variant={variant} title={children} role={role} />;
}

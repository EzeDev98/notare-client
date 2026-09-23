import type { ReactNode } from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem } from '@patternfly/react-core';

export interface FieldMessages {
  hint?: string | undefined;
  error?: string | undefined;
}

interface FieldProps extends FieldMessages {
  label: string;
  controlId: string;
  hintId: string;
  errorId: string;
  children: ReactNode;
}

/**
 * Label + control + hint/error, drawn by PatternFly's FormGroup and
 * HelperText — the same form layout internal-auth-client uses. Every field
 * (TextField, PasswordField, TextArea, Select) renders through here, so
 * field chrome lives in exactly one place and has no CSS of its own.
 *
 * The error keeps role="alert" and PatternFly's error icon (colour is never
 * the only signal). screenReaderText="" stops PatternFly appending
 * ": error status;" to the text aria-describedby announces.
 */
export function Field({ label, controlId, hintId, errorId, hint, error, children }: FieldProps) {
  const showHint = hint !== undefined && error === undefined;

  return (
    <FormGroup label={label} fieldId={controlId}>
      {children}

      {error !== undefined || showHint ? (
        <FormHelperText>
          <HelperText>
            {error !== undefined ? (
              <HelperTextItem id={errorId} variant="error" screenReaderText="" role="alert">
                {error}
              </HelperTextItem>
            ) : (
              <HelperTextItem id={hintId}>{hint}</HelperTextItem>
            )}
          </HelperText>
        </FormHelperText>
      ) : null}
    </FormGroup>
  );
}

import { useId, type ReactNode } from 'react';

import './FormField.css';

export interface FieldA11y {
  id: string;
  'aria-describedby': string;
  'aria-invalid'?: true;
}

interface FormFieldProps {
  label: string;
  optional?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
  /** Draw the control and spread `a11y` onto it so the label, hint and error are connected. */
  children: (a11y: FieldA11y) => ReactNode;
}

/**
 * Label, control, and one reserved line below for the hint or the error.
 * The error replaces the hint in the same line, so the layout never moves.
 */
export function FormField({ label, optional = false, hint, error, className, children }: FormFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const a11y: FieldA11y = { id, 'aria-describedby': messageId, ...(error ? { 'aria-invalid': true as const } : {}) };
  const classes = ['ui-form-field', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <label className="ui-form-field__label" htmlFor={id}>
        {label}
        {optional ? <span className="ui-form-field__optional">Optional</span> : null}
      </label>
      {children(a11y)}
      <p
        id={messageId}
        className={`ui-form-field__message ${error ? 'ui-form-error' : 'ui-form-field__hint'}`}
        aria-live="polite"
      >
        {error ?? hint}
      </p>
    </div>
  );
}

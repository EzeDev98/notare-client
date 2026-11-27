/** A field's label, hint and error message. */
import { useId, type ReactNode } from 'react';

import '../VisuallyHidden/VisuallyHidden.css';

import './FormField.css';

export interface FieldA11y {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

interface FormFieldProps {
  label: string;
  hideLabel?: boolean | undefined;
  optional?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
  children: (a11y: FieldA11y) => ReactNode;
}

export function FormField({ label, hideLabel = false, optional = false, hint, error, className, children }: FormFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  const a11y: FieldA11y = {
    id,
    ...(message ? { 'aria-describedby': messageId } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
  };
  const classes = ['ui-form-field', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <label className={hideLabel ? 'ui-form-field__label ui-visually-hidden' : 'ui-form-field__label'} htmlFor={id}>
        {label}
        {optional ? <span className="ui-form-field__optional">Optional</span> : null}
      </label>
      {children(a11y)}
      {message ? (
        <p
          id={messageId}
          className={`ui-form-field__message ${error ? 'ui-form-error' : 'ui-form-field__hint'}`}
          role={error ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

import type { ComponentPropsWithRef, ReactNode } from 'react';

import { Control } from '../Control/Control';
import { FormField } from '../FormField/FormField';

export type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'id' | 'children'> & {
  label: string;
  /** Keeps the label for screen readers and draws no text. */
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** An Icon shown before the text. */
  leading?: ReactNode;
  /** A control (such as an IconButton) shown after the text. */
  trailing?: ReactNode;
  /** True while the form is being sent: the field becomes read-only, not disabled. */
  submitting?: boolean;
};

/** Label, 40px input with 16px text, and one reserved hint/error line. */
export function TextField({
  label,
  hideLabel,
  hint,
  error,
  optional,
  leading,
  trailing,
  submitting = false,
  disabled,
  readOnly,
  className,
  ...rest
}: TextFieldProps) {
  const locked = submitting || readOnly;
  return (
    <FormField label={label} hideLabel={hideLabel} hint={hint} error={error} optional={optional} className={className}>
      {(a11y) => (
        <Control invalid={Boolean(error)} disabled={disabled} readOnly={locked} trailing={Boolean(trailing)}>
          {leading ? <span className="ui-control__affix">{leading}</span> : null}
          <input {...rest} {...a11y} className="ui-control__input" disabled={disabled} readOnly={locked} />
          {trailing}
        </Control>
      )}
    </FormField>
  );
}

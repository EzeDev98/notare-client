/** A single-line text field. */
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { Control } from '../Control/Control';
import { FormField } from '../FormField/FormField';

export type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'id' | 'children'> & {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  optional?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  submitting?: boolean;
};

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

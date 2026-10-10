import type { ComponentPropsWithRef } from 'react';

import { Control } from '../Control/Control';
import { FormField } from '../FormField/FormField';

type TextAreaProps = Omit<ComponentPropsWithRef<'textarea'>, 'id' | 'children'> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  submitting?: boolean;
};

/** Multi-line field: same box, label and message line as TextField. */
export function TextArea({
  label,
  hint,
  error,
  optional,
  submitting = false,
  disabled,
  readOnly,
  rows = 4,
  className,
  ...rest
}: TextAreaProps) {
  const locked = submitting || readOnly;
  return (
    <FormField label={label} hint={hint} error={error} optional={optional} className={className}>
      {(a11y) => (
        <Control invalid={Boolean(error)} disabled={disabled} readOnly={locked} multiline>
          <textarea
            {...rest}
            {...a11y}
            rows={rows}
            className="ui-control__input ui-control__input--multiline"
            disabled={disabled}
            readOnly={locked}
          />
        </Control>
      )}
    </FormField>
  );
}

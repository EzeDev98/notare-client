import { useId, type ChangeEvent, type ComponentPropsWithoutRef, type FormEvent } from 'react';
import { TextInput, type TextInputProps } from '@patternfly/react-core';

import { describedBy } from '@/design-system/components/Field/describedBy';
import { omitUndefined } from '@/design-system/lib/omitUndefined';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';

interface TextFieldProps
  extends
    Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'aria-describedby' | 'aria-invalid'>,
    FieldMessages {
  label: string;
}

/** A labelled PatternFly TextInput. Native input props pass straight through. */
export function TextField({
  label,
  hint,
  error,
  type,
  value,
  onChange,
  disabled,
  required,
  ...rest
}: TextFieldProps) {
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <TextInput
        {...omitUndefined(rest)}
        id={base}
        // PatternFly narrows `type` to the text-like inputs it supports.
        {...(type === undefined ? {} : { type: type as NonNullable<TextInputProps['type']> })}
        {...(value === undefined ? {} : { value: value as string | number })}
        {...(onChange === undefined
          ? {}
          : {
              // PatternFly passes a FormEvent; it is the same React change event.
              onChange: (event: FormEvent<HTMLInputElement>) => {
                onChange(event as ChangeEvent<HTMLInputElement>);
              },
            })}
        isDisabled={disabled === true}
        isRequired={required === true}
        validated={error === undefined ? 'default' : 'error'}
        aria-describedby={describedBy(ids, { hint, error })}
      />
    </Field>
  );
}

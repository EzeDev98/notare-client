import {
  useId,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
} from 'react';
import { FormSelect } from '@patternfly/react-core';

import { describedBy } from '@/design-system/components/Field/describedBy';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';
import { omitUndefined } from '@/design-system/lib/omitUndefined';

interface SelectProps
  extends Omit<ComponentPropsWithoutRef<'select'>, 'id' | 'aria-describedby' | 'aria-invalid' | 'onFocus' | 'onBlur'>,
    FieldMessages {
  label: string;
  children: ReactNode;
}

export function Select({
  label,
  hint,
  error,
  children,
  onChange,
  disabled,
  required,
  ...rest
}: SelectProps) {
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <FormSelect
        {...omitUndefined(rest)}
        id={base}
        {...(onChange === undefined
          ? {}
          : {
              // PatternFly passes a FormEvent; it is the same React change event.
              onChange: (event: FormEvent<HTMLSelectElement>) => {
                onChange(event as ChangeEvent<HTMLSelectElement>);
              },
            })}
        isDisabled={disabled === true}
        isRequired={required === true}
        validated={error === undefined ? 'default' : 'error'}
        aria-describedby={describedBy(ids, { hint, error })}
      >
        {children}
      </FormSelect>
    </Field>
  );
}

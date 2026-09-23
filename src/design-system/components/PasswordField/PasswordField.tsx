import { useId, useState, type ChangeEvent, type ComponentPropsWithoutRef, type FormEvent } from 'react';
import { TextInput } from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';

import { Button } from '@/design-system/components/Button/Button';
import { describedBy } from '@/design-system/components/Field/describedBy';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';
import { omitUndefined } from '@/design-system/lib/omitUndefined';
import './PasswordField.css';

interface PasswordFieldProps
  extends
    Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'aria-describedby' | 'aria-invalid' | 'type'>,
    FieldMessages {
  label: string;
}

/**
 * A PatternFly TextInput with a show/hide toggle rendered inside the
 * input's own bounds — a relatively-positioned wrapper with the toggle
 * button absolutely positioned over the input's right edge, rather than
 * PatternFly's InputGroup (which lays the button out beside the input).
 */
export function PasswordField({
  label,
  hint,
  error,
  value,
  onChange,
  disabled,
  required,
  className,
  ...rest
}: PasswordFieldProps) {
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <div className="ds-password-field">
        <TextInput
          {...omitUndefined(rest)}
          id={base}
          type={visible ? 'text' : 'password'}
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
          className={['ds-password-field__input', className].filter(Boolean).join(' ')}
        />
        <Button
          variant="ghost"
          size="sm"
          className="ds-password-field__toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => {
            setVisible((current) => !current);
          }}
        >
          {visible ? <EyeSlashIcon /> : <EyeIcon />}
        </Button>
      </div>
    </Field>
  );
}

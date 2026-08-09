import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { describedBy } from '@/design-system/components/Field/describedBy';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';
import './Select.css';

interface SelectProps
  extends
    Omit<ComponentPropsWithoutRef<'select'>, 'id' | 'aria-describedby' | 'aria-invalid'>,
    FieldMessages {
  label: string;
  children: ReactNode;
}

/**
 * A native <select> in the Field shell.
 *
 * Deferred in 2D because there was no consumer, and building an API against
 * imagined usage produces the wrong API. Registration needs a gender field, so
 * here it is — against a real requirement.
 *
 * NATIVE, not a custom listbox. A custom one means reimplementing typeahead,
 * arrow-key selection, screen-reader announcements and — the part nobody
 * manages — the mobile picker, which iOS and Android render as a native wheel
 * or sheet that no div can imitate.
 */
export function Select({ label, hint, error, className, children, ...rest }: SelectProps) {
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <select
        id={base}
        className={['ds-control', 'ds-select', className].filter(Boolean).join(' ')}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(ids, { hint, error })}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}

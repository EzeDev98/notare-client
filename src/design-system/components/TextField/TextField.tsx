import { useId, type ComponentPropsWithoutRef } from 'react';

import { describedBy } from '@/design-system/components/Field/describedBy';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';

/**
 * Omit the props this component owns, so a caller cannot pass an id that
 * breaks the label association or an aria-describedby that overwrites the
 * error wiring. The type makes the mistake unrepresentable rather than
 * documenting it.
 */
interface TextFieldProps
  extends
    Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'aria-describedby' | 'aria-invalid'>,
    FieldMessages {
  label: string;
}

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  /*
   * useId gives a stable, unique id per component instance. Hand-written ids
   * collide the moment the same field renders twice on one page; Math.random()
   * changes on every render, silently breaking the label association after the
   * first re-render.
   */
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <input
        id={base}
        className={['ds-control', className].filter(Boolean).join(' ')}
        // Announces the error STATE. describedby announces the error TEXT.
        // Both are needed; either alone leaves half the message.
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(ids, { hint, error })}
        {...rest}
      />
    </Field>
  );
}

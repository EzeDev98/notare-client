import { useId, type ComponentPropsWithoutRef } from 'react';

import { describedBy } from '@/design-system/components/Field/describedBy';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';
import './TextArea.css';

interface TextAreaProps
  extends
    Omit<ComponentPropsWithoutRef<'textarea'>, 'id' | 'aria-describedby' | 'aria-invalid'>,
    FieldMessages {
  label: string;
}

/**
 * A multi-line field. NOT the note editor — that is a different problem
 * (auto-save, conflict state, measure) and gets its own component in Step 6.
 * This is for short multi-line input: a share message, a report reason.
 */
export function TextArea({ label, hint, error, className, rows = 4, ...rest }: TextAreaProps) {
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <textarea
        id={base}
        rows={rows}
        className={['ds-control', 'ds-textarea', className].filter(Boolean).join(' ')}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(ids, { hint, error })}
        {...rest}
      />
    </Field>
  );
}

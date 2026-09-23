import { useId, type ComponentPropsWithoutRef } from 'react';
import { TextArea as PFTextArea } from '@patternfly/react-core';

import { describedBy } from '@/design-system/components/Field/describedBy';
import { omitUndefined } from '@/design-system/lib/omitUndefined';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';

interface TextAreaProps
  extends
    Omit<ComponentPropsWithoutRef<'textarea'>, 'id' | 'aria-describedby' | 'aria-invalid'>,
    FieldMessages {
  label: string;
}

/** A labelled PatternFly TextArea, resizable vertically only. */
export function TextArea({ label, hint, error, value, rows = 4, ...rest }: TextAreaProps) {
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <PFTextArea
        {...omitUndefined(rest)}
        id={base}
        rows={rows}
        {...(value === undefined ? {} : { value: value as string | number })}
        resizeOrientation="vertical"
        validated={error === undefined ? 'default' : 'error'}
        aria-describedby={describedBy(ids, { hint, error })}
      />
    </Field>
  );
}

/** Gallery row: OtpField. */
import { useState } from 'react';

import { OtpField } from '@/design-system/ui';

import { Both } from './Both';

interface PinProps {
  label: string;
  initial: string;
  length: number;
  masked: boolean;
  error?: string;
  disabled?: boolean;
}

function Pin({ label, initial, length, masked, error, disabled }: PinProps) {
  const [value, setValue] = useState(initial);
  return (
    <OtpField
      label={label}
      value={value}
      onChange={setValue}
      length={length}
      masked={masked}
      {...(error ? { error } : {})}
      {...(disabled ? { disabled } : {})}
    />
  );
}

export function Row13b() {
  return (
    <>
      <Both title="Verification code (6, not masked)">
        <div className="gallery-stack">
          <Pin label="Code" initial="" length={6} masked={false} />
          <Pin label="Code" initial="123456" length={6} masked={false} />
        </div>
      </Both>
    </>
  );
}

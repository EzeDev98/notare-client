import { useState } from 'react';

import { AvatarStack, OtpField, type Tint } from '@/design-system/ui';

import { Both } from './Both';

interface PinProps {
  label: string;
  initial: string;
  length: number;
  masked: boolean;
  error?: string;
  disabled?: boolean;
}

/** One controlled OtpField, so each demo box keeps its own value. */
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

const person = (name: string, tint: Tint) => ({ name, tint });

const ONE = [person('Ada Obi', 1)];
const THREE = [person('Ada Obi', 1), person('Tunde Bello', 2), person('Chidi Eze', 3)];
const FOUR = [...THREE, person('Ngozi Okafor', 4)];
const SIX = [...FOUR, person('Emeka Nwosu', 5), person('Funke Ade', 6)];

/** Row 13b: AvatarStack and the PIN and code boxes. */
export function Row13b() {
  return (
    <>
      <Both title="AvatarStack: one, three, four, six (shows +2)">
        <div className="gallery-stack">
          <AvatarStack people={ONE} />
          <AvatarStack people={THREE} />
          <AvatarStack people={FOUR} />
          <AvatarStack people={SIX} />
        </div>
      </Both>

      <Both title="PIN boxes (4, masked): empty, partly filled, complete, wrong, disabled">
        <div className="gallery-stack">
          <Pin label="PIN" initial="" length={4} masked />
          <Pin label="PIN" initial="12" length={4} masked />
          <Pin label="PIN" initial="1234" length={4} masked />
          <Pin label="PIN" initial="1234" length={4} masked error="Wrong PIN. Try again." />
          <Pin label="PIN" initial="" length={4} masked disabled />
        </div>
      </Both>

      <Both title="Verification code (6, not masked)">
        <div className="gallery-stack">
          <Pin label="Code" initial="" length={6} masked={false} />
          <Pin label="Code" initial="123456" length={6} masked={false} />
        </div>
      </Both>
    </>
  );
}

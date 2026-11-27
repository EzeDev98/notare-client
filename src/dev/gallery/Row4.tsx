/** Gallery row: checkbox, radio and code fields. */
import { useState } from 'react';

import { Checkbox, OtpField, Radio } from '@/design-system/ui';

import { Both } from './Both';

function OtpDemo({ initial = '', ...props }: { initial?: string; label: string; length?: number; masked?: boolean; disabled?: boolean; error?: string; hint?: string }) {
  const [value, setValue] = useState(initial);
  return <OtpField {...props} value={value} onChange={setValue} />;
}

export function Row4() {
  return (
    <>
      <h2 className="gallery-group">Row 4: Checkbox, Radio, OtpField</h2>
      <Both title="Checkbox">
        <div className="gallery-stack">
          <Checkbox label="Remember me" />
          <Checkbox label="Remember me" defaultChecked />
          <Checkbox label="Email me updates" hint="Only about your account." />
          <Checkbox label="Disabled" disabled />
          <Checkbox label="Disabled and checked" defaultChecked disabled />
        </div>
      </Both>
      <Both title="Radio (arrow keys move inside the group)">
        <div className="gallery-stack">
          <Radio name="gallery-theme" label="Light" hint="Always light." defaultChecked />
          <Radio name="gallery-theme" label="Dark" hint="Always dark." />
          <Radio name="gallery-theme" label="Disabled" disabled />
        </div>
      </Both>
      <Both title="OtpField: 6 boxes (type, paste 123456, Backspace, arrows)">
        <div className="gallery-stack">
          <OtpDemo label="Verification code" hint="Enter the 6 digits we sent." />
          <OtpDemo label="Verification code" initial="123456" error="That code is not right." />
          <OtpDemo label="Verification code" initial="123" disabled />
        </div>
      </Both>
    </>
  );
}

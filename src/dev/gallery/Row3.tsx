/** Gallery row: the text fields. */
import { Mail } from 'lucide-react';

import { Icon, PasswordField, SelectField, TextArea, TextField } from '@/design-system/ui';

import { Both } from './Both';

export function Row3() {
  return (
    <>
      <h2 className="gallery-group">Row 3: TextField, PasswordField, TextArea, SelectField</h2>
      <Both title="TextField: default, hint, optional">
        <div className="gallery-stack">
          <TextField label="First name" placeholder="First name" hint="As on your ID." />
          <TextField label="Middle name" placeholder="Middle name" optional />
          <TextField label="Email" placeholder="you@example.com" leading={<Icon icon={Mail} />} />
        </div>
      </Both>
      <Both title="TextField: error (replaces the hint, same height), disabled, submitting (read-only)">
        <div className="gallery-stack">
          <TextField label="Username" defaultValue="ada" error="That username is taken." />
          <TextField label="Email" defaultValue="ada@example.com" disabled />
          <TextField label="Name" defaultValue="Ada Obi" submitting />
        </div>
      </Both>
      <Both title="PasswordField (use the eye button)">
        <div className="gallery-stack">
          <PasswordField label="Password" hint="At least 8 characters." defaultValue="secret123" />
          <PasswordField label="Confirm password" defaultValue="abc" error="Passwords do not match." />
        </div>
      </Both>
      <Both title="TextArea">
        <div className="gallery-stack">
          <TextArea label="Feedback" placeholder="Tell us what happened" hint="Optional details help." />
          <TextArea label="Feedback" defaultValue="Too short" error="Please write at least 20 characters." />
        </div>
      </Both>
      <Both title="SelectField: placeholder, error, disabled">
        <div className="gallery-stack">
          <SelectField label="Theme" placeholder="Choose a theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
          <SelectField label="Theme" placeholder="Choose a theme" error="Choose a theme.">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
          <SelectField label="Theme" defaultValue="dark" disabled>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
        </div>
      </Both>
    </>
  );
}

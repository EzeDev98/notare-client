/** A password field with a show/hide button. */
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '../IconButton/IconButton';
import { TextField, type TextFieldProps } from '../TextField/TextField';

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'trailing' | 'leading'>;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      trailing={
        <IconButton
          icon={visible ? EyeOff : Eye}
          label="Show password"
          pressed={visible}
          disabled={props.disabled}
          onClick={() => {
            setVisible((v) => !v);
          }}
        />
      }
    />
  );
}

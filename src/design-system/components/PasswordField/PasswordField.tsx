import { useId, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { describedBy } from '@/design-system/components/Field/describedBy';
import { Field, type FieldMessages } from '@/design-system/components/Field/Field';
import './PasswordField.css';

/**
 * Same omission list as `TextField`, plus `type` — this component owns
 * that too, switching it between `password` and `text` itself. A caller
 * passing `type="text"` here would silently defeat the whole point.
 */
interface PasswordFieldProps
  extends
    Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'aria-describedby' | 'aria-invalid' | 'type'>,
    FieldMessages {
  label: string;
}

/**
 * A `TextField` that can reveal its own value.
 *
 * A SEPARATE component from `TextField`, not a `showToggle` prop bolted onto
 * it — `TextField` renders a single bare `<input>` as `Field`'s child, and a
 * toggle needs a wrapper element to position the button inside, changing
 * what that child actually is. Every other consumer of `TextField` (title,
 * username, email, search) has no use for that wrapper at all.
 *
 * The toggle is a REAL button, not a clickable icon span — keyboard-
 * reachable, gets the app's global `:focus-visible` ring for free
 * (tokens/colors.css), and `aria-pressed` announces the on/off state
 * alongside the label rather than leaving a screen reader user to infer it
 * from the icon alone.
 *
 * `Eye`/`EyeOff` from Lucide, not hand-written SVG — same icon
 * standardization pass as navItems.tsx and ThemeToggle.tsx. lucide-react
 * always sets `width`/`height` attributes on the svg itself (24 by
 * default), so there is no unstyled 300x150 flash to guard against the way
 * a bare hand-written `<svg>` needs — the old belt-and-suspenders
 * width/height props this replaced are no longer necessary.
 */
export function PasswordField({ label, hint, error, className, ...rest }: PasswordFieldProps) {
  const base = useId();
  const ids = { hintId: `${base}-hint`, errorId: `${base}-error` };
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} controlId={base} {...ids} hint={hint} error={error}>
      <div className="ds-password-field">
        <input
          id={base}
          type={visible ? 'text' : 'password'}
          className={['ds-control', 'ds-password-field__control', className]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy(ids, { hint, error })}
          {...rest}
        />
        <button
          type="button"
          className="ds-password-field__toggle"
          onClick={() => {
            setVisible((current) => !current);
          }}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
}

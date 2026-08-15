import { useId, useState, type ComponentPropsWithoutRef } from 'react';

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

/*
 * width/height attributes ADDED on top of the CSS sizing rule
 * (PasswordField.css's `.ds-password-field__toggle svg`) — belt and
 * suspenders. An <svg> with neither attribute defaults to a 300x150
 * intrinsic box (the HTML replaced-element default) until CSS has
 * loaded and painted; setting them here means the icon is never
 * momentarily oversized or dependent on stylesheet timing at all.
 */
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
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
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </Field>
  );
}

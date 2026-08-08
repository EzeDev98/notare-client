import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Spinner } from '@/design-system/components/Spinner/Spinner';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

/**
 * ComponentPropsWithoutRef<'button'> inherits EVERY native button prop —
 * onClick, disabled, aria-*, form, name, autoFocus. Declaring them by hand
 * would be forty lines that drift from the platform.
 *
 * Omit<'children'> is not needed; children is already in there and typed
 * correctly. It is restated below only for documentation.
 *
 * In React 19 `ref` is an ordinary prop, so no forwardRef wrapper. Older
 * tutorials wrap every primitive in one — that is now unnecessary, not
 * something missing here.
 */
interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  /*
   * HTML defaults <button> to type="submit". Inside a form, ANY button
   * without an explicit type submits it — which is why a "show password"
   * toggle reloads the page. Defaulting to "button" means submitting is
   * something you opt into.
   */
  type = 'button',
  ...rest
}: ButtonProps) {
  /*
   * Real `disabled`, not aria-disabled, and the trade-off is deliberate.
   *
   * disabled removes the element from the tab order, so a keyboard user never
   * discovers it. For a permanently disabled control that is bad and
   * aria-disabled plus an explanation is better.
   *
   * For a loading submit it is the right call: the button MUST NOT fire twice,
   * and preventing that in the DOM beats preventing it in a handler someone
   * might refactor. A duplicate note is worse than a skipped tab stop.
   */
  const isDisabled = disabled === true || loading;

  return (
    <button
      type={type}
      className={['ds-button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      disabled={isDisabled}
      // Announces "busy" so a screen reader user knows the press registered
      // and something is happening, rather than that nothing worked.
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" label="Working" /> : null}
      {/*
        The label stays MOUNTED while loading, hidden with CSS rather than
        replaced. Swapping it for a spinner changes the button's width
        mid-click, which shifts everything around it — and if the layout moves
        under a pointer, the next click lands somewhere unintended.
      */}
      <span className="ds-button__label">{children}</span>
    </button>
  );
}

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Button as PFButton, type ButtonProps as PFButtonProps } from '@patternfly/react-core';
import { Link } from 'react-router';

import './Button.css';

import { omitUndefined } from '@/design-system/lib/omitUndefined';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

/*
 * Notare's variant names, rendered by PatternFly. Call sites keep the
 * vocabulary they already use; only this map knows PatternFly's names.
 */
const PF_VARIANT: Record<ButtonVariant, NonNullable<PFButtonProps['variant']>> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'plain',
  danger: 'danger',
};

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows PatternFly's in-button spinner and blocks interaction. */
  loading?: boolean;
  /** Renders a router <Link> styled as this button (e.g. a modal's CTA). */
  to?: string;
  children: ReactNode;
}

/**
 * The ONE button in the app — a thin wrapper over PatternFly's Button, the
 * same pattern internal-auth-client uses. Anything that looks like a button
 * goes through here, including links that must look like one (`to`), so no
 * other file restyles a button by hand.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  to,
  children,
  className,
  // Opt INTO submitting; HTML's default type="submit" is a trap in forms.
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <PFButton
      {...omitUndefined(rest)}
      {...(to === undefined ? { type } : { component: Link, to })}
      variant={PF_VARIANT[variant]}
      size={size === 'sm' ? 'sm' : 'default'}
      // Real `disabled` while loading: a submit must never fire twice.
      isDisabled={disabled === true || loading}
      {...(loading ? { isLoading: true, spinnerAriaValueText: 'Working' } : {})}
      aria-busy={loading || undefined}
      className={['ds-button', className].filter(Boolean).join(' ')}
    >
      {children}
    </PFButton>
  );
}

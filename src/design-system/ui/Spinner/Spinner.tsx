import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';

import './Spinner.css';

interface SpinnerProps {
  size?: 'sm' | 'md';
  /** Spoken name. Ignored when `decorative` is set. */
  label?: string;
  /** Set when text or a busy button already tells the user something is loading. */
  decorative?: boolean;
  className?: string;
}

/**
 * A spinner that keeps its width (it is a fixed-size box, never text).
 * With reduced motion it pulses instead of turning.
 */
export function Spinner({ size = 'md', label = 'Loading', decorative = false, className }: SpinnerProps) {
  const classes = ['ui-spinner', size === 'sm' && 'ui-spinner--sm', className].filter(Boolean).join(' ');
  if (decorative) return <span className={classes} aria-hidden="true" />;
  return (
    <span role="status" className="ui-spinner__status">
      <span className={classes} aria-hidden="true" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}

/** A loading spinner. */
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';

import './Spinner.css';

interface SpinnerProps {
  size?: 'sm' | 'md';
  label?: string;
  decorative?: boolean;
  className?: string;
}

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

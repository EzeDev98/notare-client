import { Spinner as PFSpinner } from '@patternfly/react-core';

import { VisuallyHidden } from '@/design-system/components/VisuallyHidden/VisuallyHidden';
import './Spinner.css';

interface SpinnerProps {
  /** Announced to screen readers. Say what is loading, not just "loading". */
  label?: string;
  size?: 'sm' | 'md';
}

/**
 * PatternFly's spinner, with Notare's accessibility contract kept: the
 * visual ring is hidden from assistive tech and the real label is stated
 * in a polite live region (role="status").
 */
export function Spinner({ label = 'Loading', size = 'md' }: SpinnerProps) {
  return (
    <span className="ds-spinner" role="status">
      <PFSpinner size={size} aria-hidden="true" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}

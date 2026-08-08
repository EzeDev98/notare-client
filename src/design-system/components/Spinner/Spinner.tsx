import { VisuallyHidden } from '@/design-system/components/VisuallyHidden/VisuallyHidden';
import './Spinner.css';

interface SpinnerProps {
  /** Announced to screen readers. Say what is loading, not just "loading". */
  label?: string;
  size?: 'sm' | 'md';
}

/**
 * An indeterminate progress indicator.
 *
 * aria-hidden on the visual ring and real text in a VisuallyHidden sibling:
 * a spinning border communicates nothing to a screen reader, so the meaning
 * has to be stated. role="status" makes it a polite live region, announced
 * when it appears without interrupting whatever is being read.
 *
 * currentColor throughout, so it inherits from its context — inside a primary
 * button it is the button's text colour, in body text it is the body's,
 * with no variant prop needed.
 */
export function Spinner({ label = 'Loading', size = 'md' }: SpinnerProps) {
  return (
    <span className="ds-spinner" data-size={size} role="status">
      <span className="ds-spinner__ring" aria-hidden="true" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}

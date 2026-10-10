import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';

import './Skeleton.css';

interface SkeletonProps {
  /** Number of grey rows. The last one is shorter. */
  rows?: number | undefined;
  label?: string | undefined;
}

/** Grey placeholder rows for a first load. */
export function Skeleton({ rows = 3, label = 'Loading' }: SkeletonProps) {
  return (
    <div className="ui-skeleton" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={String(index)}
          className={index === rows - 1 && rows > 1 ? 'ui-skeleton__row ui-skeleton__row--short' : 'ui-skeleton__row'}
          aria-hidden="true"
        />
      ))}
      <VisuallyHidden>{label}</VisuallyHidden>
    </div>
  );
}

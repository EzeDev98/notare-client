import type { Ref } from 'react';

/**
 * The React twin of the static splash in index.html (7c). Same element, same
 * classes, same size, so the hand-off from the static one to this one cannot
 * move or flash. The styles live in index.html because they must exist before
 * any JavaScript or token has loaded. Change one, change both.
 */
export function StartupSplash({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="startup-splash" role="status" aria-label="Loading Notare">
      <div className="startup-splash__logo" />
    </div>
  );
}

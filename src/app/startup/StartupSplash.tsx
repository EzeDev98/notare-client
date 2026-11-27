/** The start-up splash, matching the static one in index.html. */
import type { Ref } from 'react';

export function StartupSplash({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="startup-splash" role="status" aria-label="Loading Notare">
      <div className="startup-splash__logo" />
    </div>
  );
}

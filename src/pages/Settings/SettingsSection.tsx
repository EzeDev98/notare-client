import type { ReactNode } from 'react';

/** A heading (muted, sm) over its content, on a Settings screen. */
export function SettingsSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="set__h">{heading}</h2>
      {children}
    </section>
  );
}

import type { ReactNode } from 'react';

/** A heading (muted, sm) over its content, on a Settings screen. */
export function SettingsSection({
  heading,
  centered = false,
  children,
}: {
  heading: string;
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className={centered ? 'set__h set__h--center' : 'set__h'}>{heading}</h2>
      {children}
    </section>
  );
}

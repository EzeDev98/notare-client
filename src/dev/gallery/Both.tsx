/** Shows the same content on a light and a dark surface. */
import type { ReactNode } from 'react';

export function Both({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="gallery-section">
      <h2 className="gallery-section__title">{title}</h2>
      <div className="gallery-pair">
        {(['light', 'dark'] as const).map((scheme) => (
          <div key={scheme} className="gallery-panel" style={{ colorScheme: scheme }} data-scheme={scheme}>
            <span className="gallery-panel__tag">{scheme}</span>
            <div className="gallery-panel__body">{children}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

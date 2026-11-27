/** A label on the left and its value on the right. */
import type { ReactNode } from 'react';

import './DetailRow.css';

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-detail-row">
      <span className="ui-detail-row__label">{label}</span>
      <span className="ui-detail-row__value">{children}</span>
    </div>
  );
}

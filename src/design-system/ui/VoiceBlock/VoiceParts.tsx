import { Mic } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '../Icon/Icon';

/** The flexible middle of a voice row. Holds a bar or a status word and pushes the rest right. */
export function Track({ children }: { children: ReactNode }) {
  return <div className="n-voice__track">{children}</div>;
}

/** The thin progress bar, 0 to 100. */
export function Bar({ progress = 0 }: { progress?: number | undefined }) {
  const value = Math.min(100, Math.max(0, progress));
  return (
    <div
      className="ui-bar"
      role="progressbar"
      aria-label="Voice clip progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span className="ui-bar__fill" style={{ width: `${value}%` }} />
    </div>
  );
}

/** Small status text. */
export function Word({ error, children }: { error?: boolean | undefined; children: ReactNode }) {
  return <span className={error ? 'n-voice__state n-voice__state--error' : 'n-voice__state'}>{children}</span>;
}

/** The microphone tile on the left of the permission and saving states. */
export function MicTile() {
  return (
    <span className="n-voice__mic" aria-hidden="true">
      <Icon icon={Mic} />
    </span>
  );
}

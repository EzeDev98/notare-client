import { useEffect, useRef, useState } from 'react';

import { statusSwap } from '@/design-system/motion/patterns';

import './StatusSlot.css';

/**
 * The note header's status word. Its width is reserved, so the controls beside it
 * never move, and a change fades the old word out and the new one in (fast).
 * Words: "Saving on this device", "Saved on this device", "Synced", "Offline",
 * "Sync paused", "Not saved", "View only", or "" for nothing.
 */
export function StatusSlot({ status }: { status: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(status);

  useEffect(() => {
    const element = ref.current;
    if (!element || status === shown) return;
    void statusSwap(element, () => {
      setShown(status);
    });
  }, [status, shown]);

  return (
    <span ref={ref} className="n-header__status" role="status">
      {shown}
    </span>
  );
}

/** The note header's status word. */
import { useEffect, useRef, useState } from 'react';

import { statusSwap } from '@/design-system/motion/patterns';

import './StatusSlot.css';

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

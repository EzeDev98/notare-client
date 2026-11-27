/** Plays an enter animation when an element appears. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { done } from './motion';

type Motion = {
  enter?: (el: HTMLElement) => Animation;
  exit?: (el: HTMLElement) => Animation;
};

export function usePresence<T extends HTMLElement>(
  open: boolean,
  motion: Motion = {},
): { mounted: boolean; ref: RefObject<T | null> } {
  const ref = useRef<T | null>(null);
  const [mounted, setMounted] = useState(open);
  const latest = useRef(motion);
  useEffect(() => {
    latest.current = motion;
  });

  if (open && !mounted) setMounted(true);

  const play = useCallback((kind: 'enter' | 'exit'): Animation | null => {
    const el = ref.current;
    const make = latest.current[kind];
    return el && make ? make(el) : null;
  }, []);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    ref.current?.getAnimations().forEach((a) => {
      a.cancel();
    });
    play('enter');
  }, [open, mounted, play]);

  useEffect(() => {
    if (open || !mounted) return undefined;
    let cancelled = false;
    const exit = play('exit');
    if (!exit) {
      setMounted(false);
      return undefined;
    }
    void done(exit).then(() => {
      if (!cancelled) setMounted(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mounted, play]);

  return { mounted, ref };
}

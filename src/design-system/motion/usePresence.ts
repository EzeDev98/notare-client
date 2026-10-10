import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { done } from './motion';

type Motion = {
  /** Plays when the element mounts or reopens, e.g. modalIn. */
  enter?: (el: HTMLElement) => Animation;
  /** Plays when it closes; the element unmounts when it finishes, e.g. fadeOut. */
  exit?: (el: HTMLElement) => Animation;
};

/**
 * Keeps an element mounted until its exit animation has finished, then
 * unmounts it. Render the element only while `mounted` and put `ref` on it.
 * No timers: it waits for the animation itself.
 *
 *   const { mounted, ref } = usePresence<HTMLDivElement>(open, { enter: modalIn, exit: fadeOut });
 */
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

  // Open: the element is in the DOM but not painted yet, so enter from the first frame.
  useLayoutEffect(() => {
    if (!open || !mounted) return;
    ref.current?.getAnimations().forEach((a) => {
      a.cancel();
    });
    play('enter');
  }, [open, mounted, play]);

  // Close: play the exit, then unmount. A reopen in between cancels the unmount.
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

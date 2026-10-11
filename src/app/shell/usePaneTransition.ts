import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { done } from '@/design-system/motion/motion';
import { screenIn, screenOut } from '@/design-system/motion/patterns';

export type ShellScreen = 'list' | 'note';
type Pane = RefObject<HTMLElement | null>;

const onScreen = (pane: Pane): boolean => (pane.current?.offsetParent ?? null) !== null;

/** Both panes visible at once is the two-pane layout: nothing to animate. */
const twoPane = (list: Pane, note: Pane): boolean => onScreen(list) && onScreen(note);

/**
 * Which pane the phone layout shows, with the 16px fade-through between them.
 * The pane that is leaving stays on screen while it plays its exit, then the
 * other one is shown and plays its entrance. When both panes are visible there
 * is no exit and no entrance. The layout itself is decided by CSS only, so no
 * width is spelled here. Reduced motion is handled inside the motion module.
 */
export function usePaneTransition(wanted: ShellScreen, list: Pane, note: Pane): ShellScreen {
  const [shown, setShown] = useState<ShellScreen>(wanted);
  const previous = useRef<ShellScreen>(shown);

  useEffect(() => {
    if (wanted === shown) return undefined;
    const leaving = shown === 'list' ? list.current : note.current;
    const exit =
      leaving && !twoPane(list, note)
        ? done(screenOut(leaving, wanted === 'note' ? 1 : -1))
        : Promise.resolve();
    let cancelled = false;
    void exit.then(() => {
      if (!cancelled) setShown(wanted);
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, shown, list, note]);

  useLayoutEffect(() => {
    if (previous.current === shown) return;
    previous.current = shown;
    [list.current, note.current].forEach((pane) => {
      pane?.getAnimations().forEach((animation) => {
        animation.cancel();
      });
    });
    const arriving = shown === 'list' ? list.current : note.current;
    if (arriving && !twoPane(list, note)) screenIn(arriving, shown === 'note' ? 1 : -1);
  }, [shown, list, note]);

  return shown;
}

/** Animates switching between the list and the note on a phone. */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { done } from '@/design-system/motion/motion';
import { screenIn, screenOut } from '@/design-system/motion/patterns';

export type ShellScreen = 'list' | 'note';
type Pane = RefObject<HTMLElement | null>;

const onScreen = (pane: Pane): boolean => (pane.current?.offsetParent ?? null) !== null;

const twoPane = (list: Pane, note: Pane): boolean => onScreen(list) && onScreen(note);

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

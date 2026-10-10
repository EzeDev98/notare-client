import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavigationType, useLocation, useMatches, useNavigationType, useOutlet } from 'react-router';

import { done } from '@/design-system/motion/motion';
import { screenIn, screenOut, type Direction } from '@/design-system/motion/patterns';

import './AnimatedRoutes.css';

/** 'none': swap with no animation. null: first render, nothing has happened yet. */
type Mode = Direction | 'none' | null;

function resetScroll(stage: HTMLElement): void {
  const top = { top: 0, behavior: 'instant' } as const;
  stage.scrollTo(top);
  stage.closest('main')?.scrollTo(top);
  // TODO(step 12): the editor's own scroller goes when NoteDetail is rebuilt.
  stage.querySelector('.note-detail__scroll')?.scrollTo(top);
  window.scrollTo(top);
}

/** Focus follows the screen: to its h1, else the main region. A field that took focus itself keeps it. */
function focusScreen(stage: HTMLElement): void {
  if (stage.contains(document.activeElement)) return;
  const target = stage.querySelector<HTMLElement>('h1') ?? stage.closest<HTMLElement>('main');
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

/**
 * The one screen-change boundary. The app shell stays outside it and never
 * re-renders. The old screen stays mounted while it plays screenOut, then the
 * new one mounts and plays screenIn. Forward on PUSH, back on POP, a REPLACE
 * (a redirect) swaps with no exit. After every change focus goes to the new h1
 * and scroll resets.
 *
 * Keyed by the deepest matched route id, so moving between two notes on the
 * same route does not replay the page animation.
 *
 * `fill`: the stage is the shell's scroll container (AppLayout) rather than a
 * plain wrapper (PublicLayout).
 */
export function AnimatedRoutes({ fill = false }: { fill?: boolean }) {
  const outlet = useOutlet();
  const location = useLocation();
  const type = useNavigationType();
  const id = useMatches().at(-1)?.id ?? 'root';
  const stage = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<{ id: string; mode: Mode }>({ id, mode: null });

  const direction: Direction = type === NavigationType.Push ? 1 : type === NavigationType.Pop ? -1 : 0;
  const state = location.state as { skipEnterAnimation?: boolean } | null;
  // A note opened from a note, or a hop the user did not ask for (a new note's
  // replace into its editor): an editor switch, not a page change.
  const quiet = state?.skipEnterAnimation === true || location.pathname.startsWith('/notes/');

  // The last outlet of the screen on show, kept so it can play its exit after
  // the router has already moved on.
  const frozen = useRef(outlet);
  if (id === shown.id) frozen.current = outlet;

  // No exit to play: swap in this very render, so no frame shows the old screen.
  if (id !== shown.id && (quiet || direction === 0)) {
    setShown({ id, mode: quiet ? 'none' : 0 });
  }

  const seenPath = useRef(location.pathname);
  useEffect(() => {
    const pathChanged = seenPath.current !== location.pathname;
    seenPath.current = location.pathname;
    const el = stage.current;

    if (id === shown.id) {
      // Same screen, new params (note A to note B): scroll and focus, no animation.
      if (pathChanged && el) {
        resetScroll(el);
        focusScreen(el);
      }
      return undefined;
    }

    let cancelled = false;
    const swap = (): void => {
      if (!cancelled) setShown({ id, mode: direction });
    };
    if (el?.firstElementChild) void done(screenOut(el, direction)).then(swap);
    else swap();
    return () => {
      cancelled = true;
    };
  }, [id, location.pathname, shown.id, direction]);

  // The new screen is in the page but not yet painted: drop the exit, play the entrance.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el || shown.mode === null) return;
    el.getAnimations().forEach((a) => {
      a.cancel();
    });
    resetScroll(el);
    focusScreen(el);
    if (shown.mode !== 'none') screenIn(el, shown.mode);
  }, [shown]);

  return (
    <div ref={stage} className="route-stage" data-fill={fill ? 'true' : undefined}>
      <Fragment key={shown.id}>{id === shown.id ? outlet : frozen.current}</Fragment>
    </div>
  );
}

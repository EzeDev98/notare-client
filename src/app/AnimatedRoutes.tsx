/** Animates moving from one screen to another. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavigationType, useLocation, useMatches, useNavigationType, useOutlet } from 'react-router';

import { done } from '@/design-system/motion/motion';
import { screenIn, screenOut, type Direction } from '@/design-system/motion/patterns';

import './AnimatedRoutes.css';
import { ROUTES } from '@/app/routes';

type Mode = Direction | 'none' | null;

function resetScroll(stage: HTMLElement): void {
  const top = { top: 0, behavior: 'instant' } as const;
  stage.scrollTo(top);
  stage.closest('main')?.scrollTo(top);
  stage.querySelector('.note-detail__scroll')?.scrollTo(top);
  window.scrollTo(top);
}

function focusScreen(stage: HTMLElement): void {
  if (stage.contains(document.activeElement)) return;
  const target = stage.querySelector<HTMLElement>('h1') ?? stage.closest<HTMLElement>('main');
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

export function AnimatedRoutes({ fill = false }: { fill?: boolean }) {
  const outlet = useOutlet();
  const location = useLocation();
  const type = useNavigationType();
  const id = useMatches().at(-1)?.id ?? 'root';
  const stage = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<{ id: string; mode: Mode }>({ id, mode: null });

  const direction: Direction = type === NavigationType.Push ? 1 : type === NavigationType.Pop ? -1 : 0;
  const state = location.state as { skipEnterAnimation?: boolean } | null;
  const quiet = state?.skipEnterAnimation === true || location.pathname.startsWith(`${ROUTES.notes()}/`);

  const frozen = useRef(outlet);
  if (id === shown.id) frozen.current = outlet;

  if (id !== shown.id && (quiet || direction === 0)) {
    setShown({ id, mode: quiet ? 'none' : 0 });
  }

  const seenPath = useRef(location.pathname);
  useEffect(() => {
    const pathChanged = seenPath.current !== location.pathname;
    seenPath.current = location.pathname;
    const el = stage.current;

    if (id === shown.id) {
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

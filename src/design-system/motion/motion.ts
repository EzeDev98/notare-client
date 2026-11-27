/** Runs animations, respecting reduced motion. */
const tok = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const ms = (name: string): number => {
  const raw = tok(name);
  const value = parseFloat(raw);
  return raw.endsWith('ms') || !raw.endsWith('s') ? value : value * 1000;
};

const reducedQuery = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

let forced: boolean | null = null;
export const forceReduced = (value: boolean | null): void => {
  forced = value;
};
export const reduced = (): boolean => forced ?? reducedQuery();

export type Frame = { opacity?: number | string; transform?: string };

export type Timing = {
  duration:
    '--motion-hover' | '--motion-fast' | '--motion-base' | '--motion-fly' | '--motion-reveal';
  easing: '--ease-standard' | '--ease-out';
  delay?: number;
  fill?: 'backwards' | 'forwards' | 'both';
};

export function run(el: Element, frames: Frame[], t: Timing): Animation {
  const fill = t.fill ?? 'backwards';
  if (reduced()) {
    const fades = frames.some((f) => f.opacity !== undefined);
    const from = fades ? (frames[0]?.opacity ?? 1) : 0;
    const to = fades ? (frames[frames.length - 1]?.opacity ?? 1) : 1;
    return el.animate([{ opacity: from }, { opacity: to }], {
      duration: ms('--motion-reduced'),
      easing: 'linear',
      fill,
    });
  }
  return el.animate(frames, {
    duration: ms(t.duration),
    easing: tok(t.easing),
    delay: t.delay ?? 0,
    fill,
  });
}

export const done = (animation: Animation): Promise<void> =>
  animation.finished.then(
    () => undefined,
    () => undefined,
  );

export function flip(parent: Element, mutate: () => void): void {
  if (reduced()) {
    mutate();
    return;
  }
  const offsets = (): Map<Element, number> => {
    const top = parent.getBoundingClientRect().top;
    return new Map([...parent.children].map((c) => [c, c.getBoundingClientRect().top - top]));
  };
  const before = offsets();
  mutate();
  offsets().forEach((after, child) => {
    const was = before.get(child);
    if (was === undefined || was === after) return;
    run(child, [{ transform: `translateY(${String(was - after)}px)` }, { transform: 'none' }], {
      duration: '--motion-base',
      easing: '--ease-out',
    });
  });
}

export const STAGGER_CAP = 8;

export function stagger(els: Element[], frames: Frame[], t: Timing): Animation[] {
  const step = reduced() ? 0 : ms('--motion-stagger');
  return els.map((el, i) => run(el, frames, { ...t, delay: i < STAGGER_CAP ? i * step : 0 }));
}

export function typeIn(el: HTMLElement, widthPx: number, steps: number, delay: number): Animation {
  return el.animate([{ width: '0px' }, { width: `${String(widthPx)}px` }], {
    duration: ms('--motion-reveal') * 2,
    easing: `steps(${String(steps)}, end)`,
    delay,
    fill: 'backwards',
  });
}

export function blink(el: Element): Animation {
  return el.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: ms('--motion-reveal') * 1.5,
    iterations: Infinity,
    easing: 'steps(1, end)',
  });
}

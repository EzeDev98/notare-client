/**
 * The only place that runs animations. Web Animations API, no library.
 *
 * Only transform and opacity can move: the Frame type below allows nothing
 * else, so the compiler enforces it. Durations and easings are token NAMES
 * read from the CSS at call time, never numbers typed in here.
 */

const tok = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Reads a time token as milliseconds. Accepts "260ms" or "0.26s". */
export const ms = (name: string): number => {
  const raw = tok(name);
  const value = parseFloat(raw);
  return raw.endsWith('ms') || !raw.endsWith('s') ? value : value * 1000;
};

const reducedQuery = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dev and test hook for the /dev/motion toggle: true or false overrides the
// system setting, null goes back to following it.
let forced: boolean | null = null;
export const forceReduced = (value: boolean | null): void => {
  forced = value;
};
export const reduced = (): boolean => forced ?? reducedQuery();

export type Frame = { opacity?: number | string; transform?: string };

export type Timing = {
  duration: '--motion-hover' | '--motion-fast' | '--motion-base' | '--motion-fly';
  easing: '--ease-standard' | '--ease-out';
  /** Milliseconds. Ignored under reduced motion. */
  delay?: number;
  /**
   * 'backwards' (default): hold the first frame during a delay, then return to
   * the element's own style. Use 'forwards' for an exit, so the element stays
   * hidden until it is removed.
   */
  fill?: 'backwards' | 'forwards' | 'both';
};

/**
 * Animates one element. Reduced motion lives HERE, not in CSS: every movement
 * becomes a short opacity fade between the first and last frame's opacity, so
 * an exit still fades out and an entrance still fades in.
 */
export function run(el: Element, frames: Frame[], t: Timing): Animation {
  const fill = t.fill ?? 'backwards';
  if (reduced()) {
    // A frame set with no opacity at all (a drawer sliding) fades in instead.
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

/** Resolves when the animation ends. A cancelled animation also resolves. */
export const done = (animation: Animation): Promise<void> =>
  animation.finished.then(
    () => undefined,
    () => undefined,
  );

/**
 * Sibling reflow. `mutate` must change the DOM before it returns (in React,
 * wrap the state update in flushSync). Children that stay glide from where
 * they were to where they are now. Positions are measured against the parent,
 * so scrolling in between cannot cause a false move. Reduced motion: instant.
 */
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

/** How many items get a staggered delay. Items after these appear with no delay. */
export const STAGGER_CAP = 8;

/** Starts each element --motion-stagger after the previous, for the first 8 only. */
export function stagger(els: Element[], frames: Frame[], t: Timing): Animation[] {
  const step = reduced() ? 0 : ms('--motion-stagger');
  return els.map((el, i) => run(el, frames, { ...t, delay: i < STAGGER_CAP ? i * step : 0 }));
}

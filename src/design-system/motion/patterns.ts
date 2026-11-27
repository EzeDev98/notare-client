/** One animation for each moment in the app. */
import { blink, done, flip, ms, reduced, run, stagger, STAGGER_CAP, typeIn, type Frame } from './motion';

const SHIFT = { screen: 16, menu: 4, toast: 8, banner: 12, card: 10, demo: 8 } as const;
const SCALE = 0.98;
const TICK_SCALE = 0.8;

export type Direction = 1 | -1 | 0;

const px = (n: number) => `${String(n)}px`;
const slideX = (n: number): string => (n === 0 ? 'none' : `translateX(${px(n)})`);
const rise = (n: number): string => `translateY(${px(n)})`;
const settle = (from: string): Frame[] => [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }];
const leave = (to: string): Frame[] => [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: to }];

const IN = { duration: '--motion-base', easing: '--ease-out' } as const;
const OUT = { duration: '--motion-fast', easing: '--ease-standard', fill: 'forwards' } as const;

export const screenOut = (el: Element, dir: Direction): Animation =>
  run(el, leave(slideX(-dir * SHIFT.screen)), OUT);

export const screenIn = (el: Element, dir: Direction): Animation =>
  run(el, settle(slideX(dir * SHIFT.screen)), IN);

export const modalIn = (el: Element): Animation => run(el, settle(`scale(${String(SCALE)})`), IN);

export const drawerIn = (el: Element): Animation =>
  run(el, [{ transform: 'translateX(-100%)' }, { transform: 'none' }], IN);

export const sheetIn = (el: Element): Animation =>
  run(el, [{ transform: 'translateY(100%)' }, { transform: 'none' }], IN);

export const menuIn = (el: Element): Animation =>
  run(el, settle(rise(-SHIFT.menu)), { duration: '--motion-fast', easing: '--ease-out' });

export const fadeOut = (el: Element): Animation => run(el, leave('none'), OUT);
export const menuOut = fadeOut;
export const toastOut = fadeOut;

export const toastIn = (el: Element): Animation => run(el, settle(rise(SHIFT.toast)), IN);

export const noteIn = (el: Element): Animation => run(el, [{ opacity: 0 }, { opacity: 1 }], IN);

export const barIn = (el: Element): Animation =>
  run(el, settle(rise(SHIFT.menu)), { duration: '--motion-fast', easing: '--ease-out' });
export const barOut = fadeOut;

export const bannerIn = (el: Element): Animation =>
  run(el, settle(`${rise(-SHIFT.banner)} scale(${String(SCALE)})`), IN);

export async function rowOut(el: Element, parent: Element, remove: () => void): Promise<void> {
  await done(fadeOut(el));
  flip(parent, remove);
}

export async function statusSwap(el: Element, setText: () => void): Promise<void> {
  await done(fadeOut(el));
  setText();
  await done(run(el, [{ opacity: 0 }, { opacity: 1 }], { duration: '--motion-fast', easing: '--ease-standard' }));
}

export const listFirstLoad = (rows: Element[]): Animation[] =>
  stagger(rows, [{ opacity: 0 }, { opacity: 1 }], IN);

export function cardsRise(els: Element[]): Animation[] {
  const lead = ms('--motion-fast');
  const step = ms('--motion-stagger');
  return els.map((el, i) =>
    run(el, settle(rise(SHIFT.card)), { ...IN, delay: lead + Math.min(i, STAGGER_CAP) * step }),
  );
}

export interface TypedDemoParts {
  say: HTMLElement;
  caret: HTMLElement;
  row: HTMLElement;
  notSynced: HTMLElement;
  synced: HTMLElement;
  chars: number;
}

export function playTypedDemo(parts: TypedDemoParts): () => void {
  const running: Animation[] = [];
  const start = ms('--motion-base') * 2;
  const rowAt = start + ms('--motion-reveal') * 2 + ms('--motion-fast');
  const swapAt = rowAt + ms('--motion-reveal') + ms('--motion-fly');

  if (reduced()) {
    parts.caret.hidden = true;
  } else {
    running.push(typeIn(parts.say, parts.say.getBoundingClientRect().width, parts.chars, start));
    running.push(blink(parts.caret));
  }

  const swap = { duration: '--motion-base', easing: '--ease-standard', delay: swapAt, fill: 'forwards' } as const;
  running.push(
    run(parts.row, settle(rise(-SHIFT.demo)), { ...IN, delay: rowAt, fill: 'both' }),
    run(parts.notSynced, [{ opacity: 1 }, { opacity: 0 }], swap),
    run(parts.synced, [{ opacity: 0 }, { opacity: 1 }], swap),
  );

  return () => {
    running.forEach((a) => {
      a.cancel();
    });
  };
}

export const tickIn = (el: Element): Animation => run(el, settle(`scale(${String(TICK_SCALE)})`), IN);

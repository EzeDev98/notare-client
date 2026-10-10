/**
 * One function per motion moment (master 4.4). Nobody calls run() with raw
 * numbers outside this file. Durations and easings are token names; the
 * distances below are the only geometry, named once.
 */
import { done, flip, run, stagger, type Frame } from './motion';

const SHIFT = { screen: 16, menu: 4, toast: 8, banner: 12 } as const;
const SCALE = 0.98;

/** 1 forward, -1 back, 0 no direction (a redirect: fade only). */
export type Direction = 1 | -1 | 0;

const px = (n: number) => `${String(n)}px`;
const slideX = (n: number): string => (n === 0 ? 'none' : `translateX(${px(n)})`);
const rise = (n: number): string => `translateY(${px(n)})`;
const settle = (from: string): Frame[] => [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }];
const leave = (to: string): Frame[] => [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: to }];

const IN = { duration: '--motion-base', easing: '--ease-out' } as const;
const OUT = { duration: '--motion-fast', easing: '--ease-standard', fill: 'forwards' } as const;

/** Old screen: fades and slides away against the direction of travel. */
export const screenOut = (el: Element, dir: Direction): Animation =>
  run(el, leave(slideX(-dir * SHIFT.screen)), OUT);

/** New screen: fades and slides in from the direction of travel. */
export const screenIn = (el: Element, dir: Direction): Animation =>
  run(el, settle(slideX(dir * SHIFT.screen)), IN);

export const modalIn = (el: Element): Animation => run(el, settle(`scale(${String(SCALE)})`), IN);

export const drawerIn = (el: Element): Animation =>
  run(el, [{ transform: 'translateX(-100%)' }, { transform: 'none' }], IN);

/** Short actions only (C-9). */
export const sheetIn = (el: Element): Animation =>
  run(el, [{ transform: 'translateY(100%)' }, { transform: 'none' }], IN);

export const menuIn = (el: Element): Animation =>
  run(el, settle(rise(-SHIFT.menu)), { duration: '--motion-fast', easing: '--ease-out' });

/** Plain fade out, fast. Menus, toasts and overlays leave with this. */
export const fadeOut = (el: Element): Animation => run(el, leave('none'), OUT);
export const menuOut = fadeOut;
export const toastOut = fadeOut;

export const toastIn = (el: Element): Animation => run(el, settle(rise(SHIFT.toast)), IN);

export const bannerIn = (el: Element): Animation =>
  run(el, settle(`${rise(-SHIFT.banner)} scale(${String(SCALE)})`), IN);

/**
 * Row removed: the row fades, then `remove` takes it out of the DOM (in React,
 * wrap the state update in flushSync) and the siblings glide into the gap.
 */
export async function rowOut(el: Element, parent: Element, remove: () => void): Promise<void> {
  await done(fadeOut(el));
  flip(parent, remove);
}

/** Status word change: fade out, set the text, fade in, each fast. */
export async function statusSwap(el: Element, setText: () => void): Promise<void> {
  await done(fadeOut(el));
  setText();
  await done(run(el, [{ opacity: 0 }, { opacity: 1 }], { duration: '--motion-fast', easing: '--ease-standard' }));
}

/**
 * First load of a list: rows fade in with a stagger, capped at 8. The caller
 * runs this once per list, on first load only, never on a refresh.
 */
export const listFirstLoad = (rows: Element[]): Animation[] =>
  stagger(rows, [{ opacity: 0 }, { opacity: 1 }], IN);

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'notare.sidebarWidth';
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

function clamp(value: number): number {
  // Rounded to an integer CSS px — a fractional width fed into the
  // toolbar/shell's shared grid-template-columns calc() lands the column
  // boundary (and the divider positioned against it) on a fractional
  // device pixel, which gets anti-aliased differently depending on what's
  // behind it.
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)));
}

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const parsed = stored !== null ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_WIDTH;
}

/**
 * The desktop sidebar's drag-to-resize width (AppLayout.tsx, >=1024px
 * only — the handle itself is hidden below that breakpoint the same way
 * every other desktop-only piece of the shell is, via CSS).
 *
 * Persisted to localStorage on every change rather than only on drag-end.
 * A drag-end-only version needs to read the LATEST width at the moment
 * the pointer is released, which means either a ref kept in sync on every
 * move (extra bookkeeping) or reading it from a state setter's updater
 * callback (a footgun here, since the resize handler already computes the
 * next value directly from the pointer position, not from previous
 * state). Writing on every change sidesteps both — localStorage writes
 * are cheap and synchronous, and a resize gesture lasts a second or two,
 * not the sustained high-frequency writes this pattern would be wrong for.
 */
export function useSidebarWidth() {
  const [width, setWidth] = useState(readStoredWidth);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const setClampedWidth = useCallback((value: number) => {
    setWidth(clamp(value));
  }, []);

  return { width, setWidth: setClampedWidth };
}

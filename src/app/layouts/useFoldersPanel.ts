import { useCallback, useEffect, useState } from 'react';

const OPEN_KEY = 'notare.foldersOpen';
const WIDTH_KEY = 'notare.foldersWidth';
const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 160;
const MAX_WIDTH = 360;

function clampWidth(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

function readStoredOpen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(OPEN_KEY) === 'true';
}

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const stored = window.localStorage.getItem(WIDTH_KEY);
  const parsed = stored !== null ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? clampWidth(parsed) : DEFAULT_WIDTH;
}

/**
 * The folders/accounts panel (Archived, Trash, Voice, Notifications,
 * Account, the theme toggle) — collapsed by default, toggled from the
 * button at the toolbar's own top-left corner, drag-resizable while
 * open. Same >=1024px-only scope as the note-list sidebar it sits next
 * to (AppLayout.tsx's own top comment).
 *
 * TWO persisted values, not one: whether it's open survives a reload
 * independently of how wide it is — collapsing and reopening it should
 * not reset a width someone dragged, and starting closed by default
 * (readStoredOpen's `=== 'true'`, not `!== 'false'`) matches the
 * reference app's own first-run state.
 */
export function useFoldersPanel() {
  const [isOpen, setIsOpen] = useState(readStoredOpen);
  const [width, setWidth] = useState(readStoredWidth);

  useEffect(() => {
    window.localStorage.setItem(OPEN_KEY, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    window.localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const setClampedWidth = useCallback((value: number) => {
    setWidth(clampWidth(value));
  }, []);

  return { isOpen, toggle, width, setWidth: setClampedWidth };
}

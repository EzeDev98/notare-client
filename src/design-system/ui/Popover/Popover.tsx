import { useEffect, useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { menuIn, menuOut } from '@/design-system/motion/patterns';
import { usePresence } from '@/design-system/motion/usePresence';

import './Popover.css';

export interface PopoverPoint {
  x: number;
  y: number;
}

interface PopoverProps {
  open: boolean;
  /** Called when the user clicks elsewhere, scrolls the page or resizes the window. */
  onClose: () => void;
  /** The element the list is drawn next to. */
  anchorRef: RefObject<HTMLElement | null>;
  /** menu: the list sets its own width. anchor: as wide as the anchor. */
  match?: 'menu' | 'anchor' | undefined;
  align?: 'start' | 'end' | undefined;
  /** Draw next to this screen point instead of the anchor (right-click, long-press). */
  point?: PopoverPoint | null | undefined;
  children: ReactNode;
}

const tokenPx = (name: string): number =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

/**
 * A floating list below its anchor (above, when there is no room). Fades in over
 * the fast token and out again. Drawn from tokens, never the browser's own list.
 */
export function Popover({ open, onClose, anchorRef, match = 'menu', align = 'start', point, children }: PopoverProps) {
  const { mounted, ref } = usePresence<HTMLDivElement>(open, { enter: menuIn, exit: menuOut });

  useLayoutEffect(() => {
    const element = ref.current;
    const rect = point ? new DOMRect(point.x, point.y, 0, 0) : anchorRef.current?.getBoundingClientRect();
    if (!mounted || !element || !rect) return;
    const gap = tokenPx('--gap') / 2;
    element.style.width = match === 'anchor' ? `${String(rect.width)}px` : '';
    const { offsetWidth: width, offsetHeight: height } = element;
    const below = rect.bottom + gap + height <= window.innerHeight;
    const wanted = align === 'end' ? rect.right - width : rect.left;
    const left = Math.max(gap, Math.min(wanted, window.innerWidth - width - gap));
    element.style.left = `${String(left)}px`;
    element.style.top = `${String(below ? rect.bottom + gap : rect.top - gap - height)}px`;
  }, [mounted, open, match, align, point, anchorRef, ref]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose, anchorRef, ref]);

  if (!mounted) return null;

  return createPortal(
    <div ref={ref} className={match === 'anchor' ? 'ui-popover ui-popover--anchor' : 'ui-popover'}>
      {children}
    </div>,
    document.body,
  );
}

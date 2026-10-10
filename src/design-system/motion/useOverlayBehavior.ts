import { useEffect, useRef, type MouseEvent, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open overlays, the top one last. Only the top one answers Escape and Tab.
const stack: symbol[] = [];
let scrollLocks = 0;

const lockScroll = (): void => {
  if (scrollLocks++ === 0) document.body.style.overflow = 'hidden';
};
const unlockScroll = (): void => {
  if (--scrollLocks === 0) document.body.style.overflow = '';
};

/**
 * The one dialog behaviour. While `open`: focus moves into the overlay (an
 * element marked data-autofocus wins), Tab and Shift+Tab stay inside, Escape
 * closes the TOP overlay only, page scroll is locked, and on close focus
 * returns to whatever had it before. `onScrimClick` goes on the scrim.
 */
export function useOverlayBehavior(
  open: boolean,
  { ref, onClose }: { ref: RefObject<HTMLElement | null>; onClose: () => void },
): { onScrimClick: (event: MouseEvent) => void } {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const container = ref.current;
    if (!open || !container) return undefined;

    const token = Symbol('overlay');
    const opener = document.activeElement;
    stack.push(token);
    lockScroll();

    const first = container.querySelector<HTMLElement>('[data-autofocus]') ?? container.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent): void => {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const start = items[0];
      const end = items[items.length - 1];
      if (!start || !end) {
        event.preventDefault();
        container.focus();
        return;
      }
      const inside = container.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === start)) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === end)) {
        event.preventDefault();
        start.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = stack.indexOf(token);
      if (index !== -1) stack.splice(index, 1);
      unlockScroll();
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);

  return {
    onScrimClick: (event) => {
      if (event.target === event.currentTarget) closeRef.current();
    },
  };
}

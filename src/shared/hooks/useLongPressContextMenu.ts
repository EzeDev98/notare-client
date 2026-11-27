/** Opens a context menu on press-and-hold. */
import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { LONG_PRESS_MS } from '@/core/config/timings';

const MOVE_THRESHOLD_PX = 10;

export interface LongPressContextMenuHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onClickCapture: (event: ReactMouseEvent) => void;
}

export function useLongPressContextMenu(
  onOpen: (x: number, y: number) => void,
): LongPressContextMenuHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    originRef.current = { x: event.clientX, y: event.clientY };
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      suppressNextClickRef.current = true;
      const origin = originRef.current;
      onOpen(origin ? origin.x : event.clientX, origin ? origin.y : event.clientY);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (timerRef.current === null || !originRef.current) return;

    const dx = event.clientX - originRef.current.x;
    const dy = event.clientY - originRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      clearTimer();
    }
  }

  function onPointerUp() {
    clearTimer();
  }

  function onPointerCancel() {
    clearTimer();
  }

  function onContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    clearTimer();
    suppressNextClickRef.current = true;
    onOpen(event.clientX, event.clientY);
  }

  function onClickCapture(event: ReactMouseEvent) {
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    onClickCapture,
  };
}

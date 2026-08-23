import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

const LONG_PRESS_MS = 500;
// A real long-press holds still. Movement past this is a scroll or a drag,
// not a request for the menu — cancels the timer instead of opening it.
const MOVE_THRESHOLD_PX = 10;

export interface LongPressContextMenuHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onClickCapture: (event: ReactMouseEvent) => void;
}

/**
 * Opens a context menu on right-click and a two-finger Mac trackpad click
 * (both raise the native `contextmenu` DOM event, handled instantly,
 * unchanged from the original single-handler version) OR on a plain
 * press-and-hold — touch, pen, or the LEFT mouse button — held still for
 * `LONG_PRESS_MS`, via this hook's own timer.
 *
 * Holding the primary mouse button is included on purpose, not just touch:
 * "press down on a note" is exactly how a person unfamiliar with
 * right-click-for-a-menu describes what they're doing, and restricting the
 * timer to touch/pen alone left that literal gesture doing nothing on a
 * laptop — same dead-end this hook was already built to close for iOS
 * Safari, which never fires `contextmenu` from a long-press on a plain list
 * item (that event exists there mainly for links and images).
 *
 * The one mouse case excluded from the timer is a right-button press
 * (`button !== 0`) — that already opens instantly via `contextmenu` below,
 * so starting a redundant 500ms timer under it would only race that faster
 * path for no benefit.
 *
 * Two follow-on problems a long-press timer creates, both handled here:
 *
 * 1. The finger lifting after a successful long-press still raises an
 *    ordinary `click` a beat later. Left alone, that click falls through to
 *    whatever the row is wrapped in — router `Link`s in particular — and
 *    the same gesture that opened the menu also navigates away from
 *    underneath it. `onClickCapture` swallows exactly one click right after
 *    a long-press fires (via `stopPropagation` in the CAPTURE phase, before
 *    the click ever reaches a descendant `<a>`'s own handler) and does
 *    nothing otherwise — an ordinary tap that never triggered the timer is
 *    left alone.
 * 2. A genuine scroll starts with a touchstart in the same spot a long
 *    press does. `onPointerMove` cancels the pending timer once the finger
 *    has moved past `MOVE_THRESHOLD_PX`, so scrolling the list never opens
 *    the menu underneath the user's thumb.
 */
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
    // Right-click's own pointerdown carries button === 2 (or sometimes 0 on
    // some platforms with `contextmenu` firing separately regardless) —
    // excluded here specifically for the ordinary case so it doesn't race
    // the instant native path below with a redundant 500ms timer. Touch and
    // pen never set a meaningful `button`, so this only ever filters mouse.
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
    // preventDefault suppresses the browser's OWN context menu — without
    // it, this row's custom menu would open underneath (or alongside) the
    // native one instead of replacing it. clearTimer guards the edge case
    // of a held press ALSO right-clicking mid-hold — this instant path
    // already opened the menu, so the pending timer has nothing left to do.
    event.preventDefault();
    clearTimer();
    // A Mac trackpad's two-finger click is not guaranteed to arrive as ONLY
    // a `contextmenu` event — depending on the browser it can also carry a
    // full ordinary click cycle alongside it. Left unsuppressed, that
    // stray click falls through to the row's own `Link` a beat after this
    // menu opens and navigates the page out from underneath it — the exact
    // "not seamless, something else also happens" feeling a menu that opens
    // cleanly on its own gesture should never have. Same one-shot
    // suppression the hold-timer path already uses below.
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
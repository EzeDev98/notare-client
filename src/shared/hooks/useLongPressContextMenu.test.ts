/** Tests for useLongPressContextMenu. */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLongPressContextMenu } from './useLongPressContextMenu';

function pointerEvent(overrides: {
  pointerType?: string;
  clientX?: number;
  clientY?: number;
  button?: number;
}) {
  return {
    pointerType: 'touch',
    clientX: 0,
    clientY: 0,
    button: 0,
    ...overrides,
  } as never;
}

function mouseEvent() {
  return {
    clientX: 40,
    clientY: 60,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

function renderLongPress() {
  const onOpen = vi.fn();
  const { result } = renderHook(() => useLongPressContextMenu(onOpen));
  return { onOpen, handlers: result.current };
}

describe('useLongPressContextMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after holding a touch point still for the long-press duration', () => {
    const { onOpen, handlers } = renderLongPress();

    handlers.onPointerDown(pointerEvent({ pointerType: 'touch', clientX: 12, clientY: 34 }));
    vi.advanceTimersByTime(500);

    expect(onOpen).toHaveBeenCalledWith(12, 34);
  });

  it('opens after holding the LEFT mouse button down — "press down on a note" with no right-click required', () => {
    const { onOpen, handlers } = renderLongPress();

    handlers.onPointerDown(
      pointerEvent({ pointerType: 'mouse', button: 0, clientX: 12, clientY: 34 }),
    );
    vi.advanceTimersByTime(500);

    expect(onOpen).toHaveBeenCalledWith(12, 34);
  });

  it('does not start a timer for a right mouse button press — that gesture already opens instantly via contextmenu', () => {
    const { onOpen, handlers } = renderLongPress();

    handlers.onPointerDown(pointerEvent({ pointerType: 'mouse', button: 2 }));
    vi.advanceTimersByTime(500);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('cancels the pending open if the pointer moves before the timer fires', () => {
    const { onOpen, handlers } = renderLongPress();

    handlers.onPointerDown(pointerEvent({ pointerType: 'touch', clientX: 0, clientY: 0 }));
    handlers.onPointerMove(pointerEvent({ pointerType: 'touch', clientX: 50, clientY: 0 }));
    vi.advanceTimersByTime(500);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('cancels the pending open if the pointer lifts before the timer fires', () => {
    const { onOpen, handlers } = renderLongPress();

    handlers.onPointerDown(pointerEvent({ pointerType: 'touch' }));
    handlers.onPointerUp(pointerEvent({ pointerType: 'touch' }));
    vi.advanceTimersByTime(500);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens immediately on the native contextmenu event and suppresses the browser default', () => {
    const { onOpen, handlers } = renderLongPress();
    const event = mouseEvent();

    handlers.onContextMenu(event as never);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith(40, 60);
  });

  it('also swallows the click that can follow a two-finger trackpad click, same as the hold path', () => {
    const { handlers } = renderLongPress();

    handlers.onContextMenu(mouseEvent() as never);

    const followingClick = mouseEvent();
    handlers.onClickCapture(followingClick as never);

    expect(followingClick.preventDefault).toHaveBeenCalledOnce();
    expect(followingClick.stopPropagation).toHaveBeenCalledOnce();
  });

  it('swallows exactly the one click that follows a fired long-press, not the ones after it', () => {
    const { handlers } = renderLongPress();

    handlers.onPointerDown(pointerEvent({ pointerType: 'touch' }));
    vi.advanceTimersByTime(500);

    const ghostClick = mouseEvent();
    handlers.onClickCapture(ghostClick as never);
    expect(ghostClick.preventDefault).toHaveBeenCalledOnce();
    expect(ghostClick.stopPropagation).toHaveBeenCalledOnce();

    const ordinaryClick = mouseEvent();
    handlers.onClickCapture(ordinaryClick as never);
    expect(ordinaryClick.preventDefault).not.toHaveBeenCalled();
  });

  it('leaves an ordinary click alone when no long-press ever fired', () => {
    const { handlers } = renderLongPress();

    const click = mouseEvent();
    handlers.onClickCapture(click as never);

    expect(click.preventDefault).not.toHaveBeenCalled();
    expect(click.stopPropagation).not.toHaveBeenCalled();
  });
});

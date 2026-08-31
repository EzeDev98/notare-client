import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEverStandalone, useIsStandalone } from '@/pwa/displayMode';

const STANDALONE_QUERY = '(display-mode: standalone)';

/**
 * A `matchMedia` stand-in whose `.matches` getter can be scripted to
 * return a DIFFERENT value on each call — this is what lets a test
 * reproduce "the very first synchronous read landed on the wrong answer,
 * and every read after it is correct," which is exactly the platform
 * quirk useIsStandalone's own doc comment describes (a reload catching
 * display-mode still settling back to standalone). A plain boolean stub
 * cannot express that at all: it can only be uniformly right or uniformly
 * wrong for the whole test.
 */
function stubMatchMediaWithSequence(values: boolean[]) {
  let index = 0;
  const listeners = new Set<() => void>();

  window.matchMedia = vi.fn((query: string) => {
    if (query !== STANDALONE_QUERY) {
      return {
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as MediaQueryList;
    }

    return {
      get matches() {
        const value = values[Math.min(index, values.length - 1)]!;
        index += 1;
        return value;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
    } as unknown as MediaQueryList;
  });

  return {
    /** Simulates the media query firing a genuine 'change' event. */
    fireChange: () => {
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

describe('useIsStandalone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays true when the first read is already correct', () => {
    stubMatchMediaWithSequence([true, true, true]);

    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(true);

    act(() => {
      vi.runAllTimers();
    });
    expect(result.current).toBe(true);
  });

  it('stays false in an ordinary browser tab, not just after installing', () => {
    stubMatchMediaWithSequence([false, false, false]);

    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });
    expect(result.current).toBe(false);
  });

  /*
   * THE REGRESSION TEST for the reload bug. The first read (the
   * `useState` lazy initializer, evaluated synchronously at mount) sees
   * `false` — the transient misreport the platform can produce on an
   * in-place reload of an already-installed app — but the SAME query
   * would already report `true` on any read after that. No 'change'
   * event ever fires here, deliberately: from the platform's own point of
   * view nothing changed, so this test proves the fix works WITHOUT
   * relying on that event, which is exactly the scenario the old
   * change-listener-only implementation could not recover from.
   */
  it('corrects a stale false initial read shortly after mount, with no change event', () => {
    stubMatchMediaWithSequence([false, true, true, true]);

    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current).toBe(true);
  });

  it('still responds to a genuine change event on top of the re-check', () => {
    // Consumed in order: the initial mount read, the 400ms re-check read
    // (both false — nothing to correct yet), then the read inside
    // handleChange once fireChange() actually fires below.
    const { fireChange } = stubMatchMediaWithSequence([false, false, true]);

    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });
    // The re-check's own read also happened to see false here — nothing
    // corrected yet, same as an ordinary non-standalone tab.
    expect(result.current).toBe(false);

    act(() => {
      fireChange();
    });
    expect(result.current).toBe(true);
  });
});

describe('useEverStandalone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('latches true once the re-check corrects a stale initial false read', () => {
    stubMatchMediaWithSequence([false, true, true, true]);

    const { result } = renderHook(() => useEverStandalone());
    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current).toBe(true);
  });
});

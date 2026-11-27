/** Tests for displayMode. */
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEverStandalone, useIsStandalone } from '@/pwa/displayMode';

const STANDALONE_QUERY = '(display-mode: standalone)';

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
    const { fireChange } = stubMatchMediaWithSequence([false, false, false, true]);

    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });
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

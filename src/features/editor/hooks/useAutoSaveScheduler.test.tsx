import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoSaveScheduler } from '@/features/editor/hooks/useAutoSaveScheduler';

/**
 * Fake timers throughout: the behaviour under test IS timing, and waiting real
 * seconds would make the suite slow and flaky in equal measure.
 */
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

interface HarnessProps {
  save: () => Promise<unknown>;
  hasPendingWork?: () => boolean;
  canSchedule?: () => boolean;
  onReady: (api: { schedule: () => void; flush: () => Promise<void> }) => void;
}

function Harness({ save, hasPendingWork, canSchedule, onReady }: HarnessProps) {
  const scheduler = useAutoSaveScheduler({
    save,
    canSchedule: canSchedule ?? (() => true),
    hasPendingWork: hasPendingWork ?? (() => false),
  });
  onReady(scheduler);
  return null;
}

function mount(props: Omit<HarnessProps, 'onReady'>) {
  let api!: { schedule: () => void; flush: () => Promise<void> };
  const view = render(
    <Harness
      {...props}
      onReady={(value) => {
        api = value;
      }}
    />,
  );
  return { api, view };
}

describe('debouncing', () => {
  it('makes one save for a burst of edits', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { api } = mount({ save });

    // Five keystrokes, 200ms apart — faster than the 1.2s debounce.
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        api.schedule();
        vi.advanceTimersByTime(200);
      });
    }
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_200);
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves at the ceiling even while typing continuously', async () => {
    /*
     * THE REQUIREMENT PURE DEBOUNCE MISSES.
     *
     * Someone typing without a 1.2-second pause would otherwise never save —
     * five minutes of writing, nothing sent. The max-wait is what stops that,
     * and it is the failure that loses the most work.
     */
    const save = vi.fn().mockResolvedValue(undefined);
    const { api } = mount({ save });

    // A keystroke every 500ms for 11 seconds: never a 1.2s pause.
    for (let i = 0; i < 22; i += 1) {
      act(() => {
        api.schedule();
        vi.advanceTimersByTime(500);
      });
    }

    await act(async () => {
      await Promise.resolve();
    });

    // Fired at the 10s ceiling rather than never.
    expect(save).toHaveBeenCalled();
  });
});

describe('one at a time', () => {
  it('does not start a second save while one is in flight', async () => {
    let resolveFirst: (() => void) | undefined;
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { api } = mount({ save, hasPendingWork: () => false });

    act(() => {
      api.schedule();
      vi.advanceTimersByTime(1_200);
    });
    expect(save).toHaveBeenCalledTimes(1);

    // More edits while the request is outstanding.
    act(() => {
      api.schedule();
      vi.advanceTimersByTime(1_200);
    });

    // Still one. Starting a second is the ordering problem 6D is about, and
    // the fix is not to create it.
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
  });

  it('fires a follow-up when the in-flight save was superseded', async () => {
    /*
     * The request carried the text as it was when it STARTED. If the user
     * typed while it was in flight, the server is now behind — and without a
     * follow-up it stays behind forever, while the indicator honestly reports
     * "Unsaved changes" and nothing ever acts on it.
     */
    let pending = true;
    const save = vi.fn().mockImplementation(() => {
      // After the first save, the second finds nothing left to do.
      const result = Promise.resolve();
      if (save.mock.calls.length >= 2) pending = false;
      return result;
    });

    const { api } = mount({ save, hasPendingWork: () => pending });

    await act(async () => {
      api.schedule();
      vi.advanceTimersByTime(1_200);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_200);
      await Promise.resolve();
    });

    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('gating', () => {
  it('schedules nothing while offline or in conflict', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { api } = mount({ save, canSchedule: () => false });

    act(() => {
      api.schedule();
      vi.advanceTimersByTime(30_000);
    });

    // Offline would fail on a loop; a conflicting save would overwrite
    // somebody else's work, which §20 rules out.
    expect(save).not.toHaveBeenCalled();
  });
});

describe('flush', () => {
  it('saves immediately, skipping the debounce', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { api } = mount({ save });

    act(() => {
      api.schedule();
    });

    await act(async () => {
      await api.flush();
    });

    // Blur is a strong signal that a thought is finished; waiting out 1.2 more
    // seconds reads as the app not keeping up.
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps going after a failed save', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('nope')).mockResolvedValue(undefined);
    const { api } = mount({ save });

    await act(async () => {
      await api.flush();
    });

    // A rejection must not leave the scheduler stuck: the in-flight guard has
    // to clear in `finally`, or every later save is silently skipped.
    await act(async () => {
      await api.flush();
    });

    expect(save).toHaveBeenCalledTimes(2);
  });
});

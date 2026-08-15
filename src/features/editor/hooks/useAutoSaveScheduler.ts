import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Quiet period before saving. */
const DEBOUNCE_MS = 1_200;

/**
 * Ceiling on how long unsaved work can sit, however continuously the user
 * types.
 *
 * THE REQUIREMENT PEOPLE FORGET. Pure debounce means someone who types without
 * a 1.2-second pause never saves at all — write for five minutes and nothing
 * has been sent. This is the floor that stops that, and it is the one whose
 * absence loses the most work.
 */
const MAX_WAIT_MS = 10_000;

interface SchedulerOptions {
  /** Performs the save. May throw; the scheduler keeps going regardless. */
  save: () => Promise<unknown>;
  /** False while offline or in conflict — nothing should be scheduled then. */
  canSchedule: () => boolean;
  /** True when work remains after a save completes. */
  hasPendingWork: () => boolean;
}

/**
 * Decides WHEN to save. What a save does is somebody else's problem.
 *
 * Everything here is refs rather than state, on purpose: none of it should
 * cause a render, and all of it must be readable synchronously. A timer id in
 * state would be a render per keystroke and a value that is one render stale
 * exactly when it is read.
 */
export function useAutoSaveScheduler({ save, canSchedule, hasPendingWork }: SchedulerOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the current run of unsaved edits began, for the max-wait ceiling. */
  const firstEditAtRef = useRef<number | null>(null);
  /** Synchronous in-flight guard. State would land a render too late. */
  const inFlightRef = useRef(false);

  /*
   * The callbacks are mirrored into refs so `schedule` never changes identity.
   * Otherwise every keystroke recreates it, which recreates the effect that
   * uses it, which tears down and rebuilds the listeners below — per character.
   */
  const optionsRef = useRef({ save, canSchedule, hasPendingWork });
  optionsRef.current = { save, canSchedule, hasPendingWork };

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const run = useCallback(async (): Promise<void> => {
    timerRef.current = null;

    /*
     * A save is already in flight. Do NOT start a second one — that is the
     * ordering problem 6D is about, and the fix is not to create it. The
     * completion handler below fires a follow-up instead.
     */
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    firstEditAtRef.current = null;

    try {
      await optionsRef.current.save();
    } catch {
      /*
       * Swallowed HERE, deliberately. The save path already dispatched the
       * right state — conflict, offline, or error — and rethrowing would leave
       * an unhandled rejection from a background timer with nobody to catch it.
       */
    } finally {
      inFlightRef.current = false;

      /*
       * THE FOLLOW-UP.
       *
       * The request that just finished carried the text as it was when it
       * STARTED. If the user typed while it was in flight, the note on the
       * server is now behind — and without this, it stays behind forever while
       * the indicator honestly reports "Unsaved changes" and nothing ever acts
       * on it.
       *
       * This is 6B's supersededByEdits flag becoming a request.
       */
      if (optionsRef.current.hasPendingWork() && optionsRef.current.canSchedule()) {
        scheduleRef.current();
      }
    }
  }, []);

  const schedule = useCallback(() => {
    if (!optionsRef.current.canSchedule()) return;

    firstEditAtRef.current ??= Date.now();
    clearTimer();

    /*
     * ONE timer, not two. The delay is the debounce, shortened as the max-wait
     * ceiling approaches:
     *
     *   elapsed 0     -> 1200ms   (ordinary debounce)
     *   elapsed 9500  -> 500ms    (lands exactly at the 10s ceiling)
     *
     * Two independent timers would also work and would race each other at the
     * boundary, firing two saves for one edit.
     */
    const elapsed = Date.now() - firstEditAtRef.current;
    const delay = Math.min(DEBOUNCE_MS, Math.max(0, MAX_WAIT_MS - elapsed));

    timerRef.current = setTimeout(() => {
      void run();
    }, delay);
  }, [clearTimer, run]);

  // `run` needs to call `schedule`, and `schedule` needs `run`. A ref breaks
  // the cycle without making either depend on the other's identity.
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  /** Saves now, skipping the debounce. For blur and for leaving the page. */
  const flush = useCallback(async (): Promise<void> => {
    clearTimer();
    await run();
  }, [clearTimer, run]);

  useEffect(() => {
    /*
     * VISIBILITYCHANGE, not beforeunload.
     *
     * beforeunload cannot await anything. sendBeacon cannot send a PATCH with
     * an Authorization header. fetch(keepalive) can, and the browser may still
     * cut it short.
     *
     * So this is best-effort and usually completes — and the honest statement
     * is that CLOSING THE TAB MID-SENTENCE CAN LOSE UP TO ~1.2 SECONDS OF
     * TYPING. Step 7 fixes it properly by writing every keystroke to
     * IndexedDB, at which point the network save stops being the only copy.
     */
    const onHidden = (): void => {
      if (document.visibilityState === 'hidden') void flush();
    };

    document.addEventListener('visibilitychange', onHidden);

    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      clearTimer();
      /*
       * A final attempt on unmount — navigating away from the editor.
       * Fire-and-forget: the component is gone and there is nothing left to
       * report to. It usually lands, and Step 7 makes it not matter.
       */
      void run();
    };
  }, [flush, clearTimer, run]);

  /*
   * MEMOIZED, not a fresh object literal. `schedule` and `flush` are each
   * individually stable (`useCallback` with stable deps), but returning
   * `{ schedule, flush }` bare gives every CALLER a NEW object identity on
   * every render regardless — and `useNoteEditor`'s reconnect effect
   * depends on this object (`[online, scheduler]`). An unmemoized return
   * value means that effect's cleanup+effect pair reruns on EVERY render,
   * not just when `online` actually changes — and since `hasPendingWork()`
   * reads true immediately after any edit, that effect was calling
   * `scheduler.flush()` on every single render following a keystroke,
   * bypassing the whole debounce this file exists to provide.
   *
   * This was ALWAYS true, but masked: `save()`'s "nothing to send" check
   * read a `rowRef.current.dirty` that stayed stale at 0 until Dexie's
   * live query caught up (a separate bug, fixed in useNoteEditor.ts's
   * `draftOverride`), so the erroneous immediate flush silently no-op'd.
   * Fixing that bug correctly made `dirty` reflect `1` the instant an edit
   * happens — which is what turned this dormant bug into an actual
   * premature save, firing well before the intended debounce or explicit
   * blur/flush ever got a chance to run.
   */
  return useMemo(() => ({ schedule, flush }), [schedule, flush]);
}

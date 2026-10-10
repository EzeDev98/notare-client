import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { router } from '@/app/router';
import { decideRoute } from '@/app/startup/decideRoute';
import { FONT_WAIT_MAX_MS, SPLASH_MIN_MS } from '@/core/config/timings';
import { db } from '@/features/notes/local/database';
import { useEverStandalone } from '@/pwa/displayMode';

/** Install is required before anything else. Revisit in step 10e (O-14). */
const INSTALL_MANDATORY = true;

/** Vitest sets MODE to 'test'. Waits collapse to zero there so tests need no fake timers. */
const IS_TEST = import.meta.env.MODE === 'test';

/**
 * Where start-up has got to.
 *   waiting  splash only.
 *   install  the install gate is showing.
 *   offline  the first-open-offline screen is showing.
 *   app      the router is showing. Final: nothing later may take it away.
 */
export type StartupOutcome = 'waiting' | 'install' | 'offline' | 'app';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Resolves when the font is ready, or after FONT_WAIT_MAX_MS, whichever is first. */
function fontReady(): Promise<void> {
  if (IS_TEST || typeof document === 'undefined' || !('fonts' in document))
    return Promise.resolve();
  const loaded = document.fonts.load('400 1em "Red Hat Text"').then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([loaded, wait(FONT_WAIT_MAX_MS)]);
}

async function hasLocalNotes(): Promise<boolean> {
  try {
    return (await db.notes.count()) > 0;
  } catch {
    // If the local database cannot be read, do not claim the device is empty.
    return true;
  }
}

/**
 * The one start-up hand-off (master 5.5). Waits for the font (at most
 * FONT_WAIT_MAX_MS), a short minimum so the splash never flickers, and the
 * session check. Then it asks decideRoute once, moves the router to the answer
 * before anything shows, and reports where it landed. The caller fades the
 * splash out when the outcome stops being 'waiting'.
 */
export function useStartup(): {
  outcome: StartupOutcome;
  /** Decide again, for the offline screen. True when it got past offline. */
  retry: () => Promise<boolean>;
} {
  const { state } = useAuth();
  const installed = useEverStandalone();
  const hasSession = state.status === 'authenticated' || state.status === 'refreshing';
  const authReady = state.status !== 'initializing';

  const [timersDone, setTimersDone] = useState(false);
  const [outcome, setOutcome] = useState<StartupOutcome>('waiting');
  const latest = useRef({ hasSession, installed });
  latest.current = { hasSession, installed };
  const deciding = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([wait(IS_TEST ? 0 : SPLASH_MIN_MS), fontReady()]).then(() => {
      if (!cancelled) setTimersDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = useCallback(async (): Promise<StartupOutcome> => {
    const { pathname, search } = window.location;
    const decision = decideRoute({
      pathname,
      search,
      hasSession: latest.current.hasSession,
      installed: latest.current.installed,
      installMandatory: INSTALL_MANDATORY,
      online: navigator.onLine,
      hasLocalData: await hasLocalNotes(),
    });
    if (decision.kind === 'go') {
      await router.navigate(decision.to, {
        replace: true,
        ...(decision.from === undefined ? {} : { state: { from: decision.from } }),
      });
    }
    const next = decision.kind === 'go' || decision.kind === 'stay' ? 'app' : decision.kind;
    setOutcome(next);
    return next;
  }, []);

  useEffect(() => {
    if (!timersDone || !authReady || deciding.current) return;
    deciding.current = true;
    void decide();
  }, [timersDone, authReady, decide]);

  // The install gate leaves on its own the moment the app is installed.
  useEffect(() => {
    if (outcome === 'install' && installed) void decide();
  }, [outcome, installed, decide]);

  const retry = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;
    return (await decide()) !== 'offline';
  }, [decide]);

  return { outcome, retry };
}

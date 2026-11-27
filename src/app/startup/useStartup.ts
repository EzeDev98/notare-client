/** Runs start-up and moves to the first screen. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { router } from '@/app/router';
import { decideRoute } from '@/app/startup/decideRoute';
import { FONT_WAIT_MAX_MS, SPLASH_MIN_MS } from '@/core/config/timings';
import { db } from '@/features/notes/local/database';
import { metaRepository } from '@/features/notes/local/metaRepository';
import { META_KEYS } from '@/features/notes/local/metaRow';
import { useEverStandalone } from '@/pwa/displayMode';

const IS_TEST = import.meta.env.MODE === 'test';

export type StartupOutcome = 'waiting' | 'install' | 'offline' | 'app';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function fontReady(): Promise<void> {
  if (IS_TEST || typeof document === 'undefined' || !('fonts' in document))
    return Promise.resolve();
  const loaded = document.fonts.load('400 1em "Red Hat Text"').then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([loaded, wait(FONT_WAIT_MAX_MS)]);
}

async function readInstallChoice(chosenNow: boolean): Promise<'browser' | null> {
  if (chosenNow) return 'browser';
  try {
    return (await metaRepository.get<string>(META_KEYS.installChoice)) === 'browser' ? 'browser' : null;
  } catch {
    return null;
  }
}

async function hasLocalNotes(): Promise<boolean> {
  try {
    return (await db.notes.count()) > 0;
  } catch {
    return true;
  }
}

export function useStartup(): {
  outcome: StartupOutcome;
  retry: () => Promise<boolean>;
  continueInBrowser: () => Promise<void>;
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
  const browserChosen = useRef(false);

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
      installChoice: await readInstallChoice(browserChosen.current),
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

  useEffect(() => {
    if (outcome === 'install' && installed) void decide();
  }, [outcome, installed, decide]);

  const continueInBrowser = useCallback(async (): Promise<void> => {
    browserChosen.current = true;
    try {
      await metaRepository.set(META_KEYS.installChoice, 'browser');
    } catch {}
    await decide();
  }, [decide]);

  const retry = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;
    return (await decide()) !== 'offline';
  }, [decide]);

  return { outcome, retry, continueInBrowser };
}

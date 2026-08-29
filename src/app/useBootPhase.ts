import { useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { useEverStandalone } from '@/pwa/displayMode';

/**
 * Step 4a. The three-state model App.tsx's AppBoot renders against.
 */
export type BootPhase = 'splash' | 'install' | 'ready';

/**
 * Step 8a/10b. The visual sub-stages AppSplash renders while phase is
 * 'splash'.
 *
 *   'active'  — tagline + animated dots + footer, no logo. Step 10b
 *               removed the logo entirely: it duplicated the native
 *               OS/Chrome splash that already shows the icon before any
 *               of this JS has even loaded, and two logo-only screens
 *               back to back read as broken rather than intentional.
 *   'leaving' — same content, with AppSplash.css's fade-out class
 *               applied, so the swap to whatever phase comes next isn't
 *               an abrupt cut.
 */
export type SplashStage = 'active' | 'leaving';

/**
 * Step 10b. Minimum dwell + fade time for the splash, in ms — "the last
 * dotted loading page ... should stay for 1s". Only one in-app stage
 * now, so only one dwell timer (Step 8b's separate logo-stage timer is
 * gone along with the stage itself).
 *
 * IS_TEST collapses both to 0 under Vitest (MODE is 'test' by default
 * under the test runner) so App.test.tsx's `waitFor` assertions keep
 * passing without fake-timer plumbing; every real browser run still
 * gets the full durations.
 */
const IS_TEST = import.meta.env.MODE === 'test';
const SPLASH_MIN_MS = IS_TEST ? 0 : 1000;
const SPLASH_FADE_MS = IS_TEST ? 0 : 200;

/**
 * Step 4b/8c/10b. Combines Step 1's install-detection, AuthProvider's
 * init state, and this step's minimum-dwell timer into the phase +
 * splash sub-stage AppBoot renders against.
 *
 * `everStandalone` now comes from displayMode.ts's shared
 * useEverStandalone() (Step 10a) instead of being computed locally —
 * App.tsx's UpdateAvailableModal gating needs the identical latch
 * semantics outside AuthProvider, where this hook can't be called.
 */
export function useBootPhase(): { phase: BootPhase; splashStage: SplashStage } {
  const { state } = useAuth();
  const everStandalone = useEverStandalone();

  const [splashStage, setSplashStage] = useState<SplashStage>('active');
  const [minDwellElapsed, setMinDwellElapsed] = useState(false);
  const [fadeElapsed, setFadeElapsed] = useState(false);

  // Runs once per mount — replays on every fresh cold start. No
  // dependency on auth state, so a fast-resolving AuthProvider can
  // never shorten it.
  useEffect(() => {
    const toDwellElapsed = setTimeout(() => setMinDwellElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(toDwellElapsed);
  }, []);

  const authReady = state.status !== 'initializing';
  const readyToLeave = authReady && minDwellElapsed;

  // Fires once whichever of auth-ready / min-dwell-elapsed finishes
  // last flips readyToLeave true. Plays the 'leaving' fade, then holds
  // phase at 'splash' one more beat (fadeElapsed) so the CSS opacity
  // transition finishes before AppBoot unmounts AppSplash.
  useEffect(() => {
    if (!readyToLeave) return;
    setSplashStage('leaving');
    const toFadeElapsed = setTimeout(() => setFadeElapsed(true), SPLASH_FADE_MS);
    return () => clearTimeout(toFadeElapsed);
  }, [readyToLeave]);

  let phase: BootPhase;
  if (!readyToLeave || !fadeElapsed) {
    phase = 'splash';
  } else if (!everStandalone) {
    phase = 'install';
  } else {
    phase = 'ready';
  }

  return { phase, splashStage };
}

import { useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { useIsStandalone } from '@/pwa/displayMode';

/**
 * Step 4a. The three-state model App.tsx's AppBoot renders against.
 */
export type BootPhase = 'splash' | 'install' | 'ready';

/**
 * Step 8a. The visual sub-stages AppSplash renders while phase is
 * 'splash'.
 *
 *   'logo'    — mark only, no wordmark/tagline/dots. The plain
 *               logo-on-background screen (Image 5 in the design ref).
 *   'branded' — mark + wordmark + tagline + animated dots + footer.
 *               The branded loading screen (Image 4).
 *   'leaving' — same content as 'branded', with AppSplash.css's
 *               fade-out class applied, so the swap to whatever phase
 *               comes next isn't an abrupt cut.
 *
 * NOT the same thing as the native OS/Chrome splash screen that can
 * appear before any of this JS has even loaded (built from the
 * manifest's icon + background_color) — that one has no React state to
 * attach a duration to and isn't controlled here.
 */
export type SplashStage = 'logo' | 'branded' | 'leaving';

/**
 * Step 8b. Fixed minimum dwell time per stage, in ms.
 *
 * Before this step, 'splash' lasted exactly as long as AuthProvider's
 * init took — often under 100ms for a warm localStorage read, which is
 * why it "flashed and disappeared": there was never an enforced floor.
 *
 * 1000ms/1000ms, not 40ms — 40ms isn't reliably perceivable or
 * schedulable (a single dropped frame at 60fps is already 16.6ms), so
 * this uses the stated fallback for both stages instead.
 *
 * IS_TEST collapses all three to 0 under Vitest (MODE is 'test' by
 * default under the test runner) so App.test.tsx's existing `waitFor`
 * assertions, written against the old undelayed behaviour, keep passing
 * without needing fake-timer plumbing. Every real browser run still
 * gets the full durations below.
 */
const IS_TEST = import.meta.env.MODE === 'test';
const SPLASH_STAGE1_MS = IS_TEST ? 0 : 1000; // 'logo'
const SPLASH_STAGE2_MS = IS_TEST ? 0 : 1000; // 'branded', minimum dwell
const SPLASH_FADE_MS = IS_TEST ? 0 : 200; // 'leaving'

/**
 * Step 4b/8c. Combines Step 1's install-detection, AuthProvider's init
 * state, and this step's minimum-dwell timers into the phase + splash
 * sub-stage AppBoot renders against.
 *
 * `everStandalone` LATCHES rather than re-reading useIsStandalone()
 * live — display-mode is not the monotonic one-way signal it looks
 * like; it can flip back to non-standalone briefly right after a real
 * install completes, with no reload or uninstall in between. Once it's
 * read true even once this session, this hook commits to leaving
 * 'install' behind for good.
 */
export function useBootPhase(): { phase: BootPhase; splashStage: SplashStage } {
  const { state } = useAuth();
  const isStandalone = useIsStandalone();

  const [everStandalone, setEverStandalone] = useState(isStandalone);
  const [splashStage, setSplashStage] = useState<SplashStage>('logo');
  const [minDwellElapsed, setMinDwellElapsed] = useState(false);
  const [fadeElapsed, setFadeElapsed] = useState(false);

  useEffect(() => {
    if (isStandalone) setEverStandalone(true);
  }, [isStandalone]);

  // Runs once per mount — replays the full sequence on every fresh
  // cold start. Deliberately no dependency on auth state, so a
  // fast-resolving AuthProvider can never shorten either timer.
  useEffect(() => {
    const toBranded = setTimeout(() => setSplashStage('branded'), SPLASH_STAGE1_MS);
    const toDwellElapsed = setTimeout(
      () => setMinDwellElapsed(true),
      SPLASH_STAGE1_MS + SPLASH_STAGE2_MS,
    );
    return () => {
      clearTimeout(toBranded);
      clearTimeout(toDwellElapsed);
    };
  }, []);

  const authReady = state.status !== 'initializing';
  const readyToLeave = authReady && minDwellElapsed;

  // Fires once whichever of auth-ready / min-dwell-elapsed finishes
  // last flips readyToLeave true. Plays the 'leaving' fade, then holds
  // phase at 'splash' one more beat (fadeElapsed) so the CSS opacity
  // transition has time to finish before AppBoot unmounts AppSplash.
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

import { useEffect, useState } from 'react';

/**
 * Step 1a. Detects whether the app is currently running as an installed,
 * standalone PWA rather than inside ordinary browser chrome (a tab, with
 * the address bar, back/forward buttons, etc. visible).
 *
 * This matters for the boot flow: an installed app has nothing left to
 * install, so it should never see the mandatory InstallPage (Step 3) no
 * matter what beforeinstallprompt does or doesn't do.
 *
 * TWO SEPARATE SIGNALS, because no single API covers every platform:
 *
 * 1. `matchMedia('(display-mode: standalone)')` — the standard signal.
 *    True once Chromium/Android (and desktop Chrome, Edge) launches the
 *    app from its installed icon rather than a browser tab. This is a
 *    live media query, not a one-time snapshot — see useIsStandalone
 *    below for why that matters.
 *
 * 2. `navigator.standalone` — Safari/iOS's own non-standard property,
 *    long predating the Display Mode Level 1 spec. iOS Safari does not
 *    implement the `display-mode` media feature the same way, so #1
 *    alone under-detects there. `navigator.standalone` is not in
 *    lib.dom.d.ts, hence the local `Navigator & { standalone?: boolean }`
 *    cast rather than a global augmentation.
 *
 * Neither signal fires or changes on its own — both are read-once
 * conditions of the current window, which is exactly what a boot-time
 * check needs.
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;

  const matchesDisplayModeMediaQuery =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  const iosStandaloneNavigator = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;

  return matchesDisplayModeMediaQuery || iosStandaloneNavigator === true;
}

/**
 * How long to wait before re-checking a synchronous initial read that may
 * have been a transient false negative — see the RELOAD BUG comment on
 * `useIsStandalone` below. Comfortably under `useBootPhase`'s
 * `SPLASH_MIN_MS` (1000ms): the point is for this correction to land WHILE
 * still on the splash screen in the common case, so a person reloading an
 * already-installed app never sees the mandatory InstallPage flash at all,
 * rather than merely recovering from it a moment after it appeared.
 */
const STANDALONE_RECHECK_MS = 400;

/**
 * Reactive form of the above, for components that need to re-render if
 * display mode changes mid-session — e.g. a user installs the app from
 * the mandatory InstallPage without a full reload, and the app needs to
 * notice it is now standalone without waiting for the next cold start.
 *
 * `navigator.standalone` is intentionally NOT re-read here: it cannot
 * change during a session (iOS only sets it at launch), so there is
 * nothing to subscribe to. Only the media query can transition live,
 * via its own `change` event.
 *
 * THE RELOAD BUG, and why a `change` LISTENER ALONE cannot fix it. This
 * hook's initial state is a single synchronous snapshot
 * (`isStandaloneDisplayMode()`, read once via `useState`'s lazy
 * initializer) — correct the overwhelming majority of the time, but not
 * guaranteed: reloading an ALREADY-installed app (not a fresh launch from
 * the home-screen icon — an in-place reload of a running standalone
 * window) can catch the platform still settling the window's display mode
 * back into standalone, and this hook's very first synchronous read can
 * land in that gap and see `false`. Nothing is actually CHANGING from the
 * platform's point of view — the window was standalone before the reload
 * and is standalone after it, just misreported for an instant — so no
 * `change` event ever fires to correct it, and `useEverStandalone`'s
 * one-directional latch (by design: never resets true back to false) locks
 * onto that wrong `false` for the rest of the session. `useBootPhase` reads
 * exactly that latch to decide 'install' vs 'ready', so this is the actual
 * mechanism behind "reloading sends me back to the install screen until I
 * fully kill and reopen the app" — a fresh cold launch gets an independent
 * new first read, which is far less likely to land in the same narrow
 * window twice in a row, so it looks "fixed" by killing and reopening when
 * really it just didn't reproduce that time.
 *
 * The fix is a single delayed RE-CHECK below, not a bigger one-time delay
 * before the first read (which would slow down the correct, common case
 * for everyone to hedge against the rare one) and not polling forever
 * (nothing after the platform settles will ever change again on its own).
 * One re-read shortly after mount, applied only if it disagrees with the
 * value already in state, corrects a bad initial snapshot without
 * changing anything when the initial read was already right.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(isStandaloneDisplayMode);

  // Diagnostic: logs the value this hook started with, once, on mount —
  // without this there is no visibility into whether a later "changed to
  // false" warning below is a genuine transition FROM true, or whether
  // this simply started false the entire time and whatever was on screen
  // a moment earlier was not actually bootPhase's 'ready' at all.
  useEffect(() => {
    console.warn(
      `[pwa] display-mode standalone started as ${standalone} at ${Math.round(performance.now())}ms since navigation start`,
    );
    // Intentionally reads the value captured at mount, not a live one —
    // this fires once, describing the initial render, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => {
      const next = isStandaloneDisplayMode();
      // console.warn, not console.debug — Chrome's DevTools console hides
      // Verbose-level messages (which is what console.debug maps to) under
      // its log-level filter BY DEFAULT, and almost nobody has that toggled
      // on. A diagnostic that silently produces no visible output unless a
      // non-default DevTools setting is already enabled is not a useful
      // diagnostic. warn/error are never filtered by default, which is
      // worth the visual noise for something this temporary and this rare
      // an event.
      // performance.now() rather than a stack trace: a stack trace on a
      // browser-dispatched media-query callback just shows browser
      // internals, not application code, and is not actionable. Time
      // since navigation start IS actionable — it tells us whether this
      // fires immediately, a genuine "few seconds" in, or somewhere else
      // entirely relative to the rest of boot.
      console.warn(
        `[pwa] display-mode standalone changed to ${next} at ${Math.round(performance.now())}ms since navigation start`,
      );
      setStandalone(next);
    };

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  /*
   * THE RE-CHECK — see this hook's own top comment for the bug this fixes.
   * One-shot, not an interval: the platform's display-mode genuinely
   * settles within milliseconds of a reload, so a single re-read shortly
   * after mount is enough, and anything past that is better served by the
   * `change` listener above, which covers a REAL transition (e.g.
   * installing from the mandatory InstallPage without a reload).
   *
   * Only calls `setStandalone` when the re-read actually disagrees with
   * what state already holds — the overwhelmingly common case is "the
   * first read was already correct," and that path must stay a no-op
   * rather than an unconditional extra render for every single mount.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setStandalone((current) => {
        const rechecked = isStandaloneDisplayMode();
        if (rechecked === current) return current;

        console.warn(
          `[pwa] display-mode standalone corrected from ${current} to ${rechecked} at ${Math.round(performance.now())}ms since navigation start — initial read was stale`,
        );
        return rechecked;
      });
    }, STANDALONE_RECHECK_MS);

    return () => clearTimeout(timer);
  }, []);

  return standalone;
}

/**
 * Step 8d/10a. Latches useIsStandalone() rather than exposing the live
 * value directly. Two separate call sites need "has this session ever
 * been confirmed as the installed app" rather than "is it standalone
 * RIGHT NOW":
 *
 *   - useBootPhase.ts: once install is confirmed, a later transient
 *     `false` reading (a known Chrome quirk right after a real install
 *     completes) must not eject someone back onto the mandatory
 *     InstallPage.
 *   - App.tsx's UpdateAvailableModal placement: a first-time visitor on
 *     the install gate has nothing installed to update, so the modal
 *     must never appear for them — but once this reads true, it should
 *     keep offering updates even through a later transient blip.
 *
 * Lazy initial value, not `useState(false)`: a cold start that's ALREADY
 * standalone must commit from its very first render, not lag a tick
 * behind an effect that hasn't run yet.
 */
export function useEverStandalone(): boolean {
  const isStandalone = useIsStandalone();
  const [everStandalone, setEverStandalone] = useState(isStandalone);

  useEffect(() => {
    // One-directional on purpose — never resets to false.
    if (isStandalone) setEverStandalone(true);
  }, [isStandalone]);

  return everStandalone;
}

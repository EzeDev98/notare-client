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
 * Reactive form of the above, for components that need to re-render if
 * display mode changes mid-session — e.g. a user installs the app from
 * the mandatory InstallPage without a full reload, and the app needs to
 * notice it is now standalone without waiting for the next cold start.
 *
 * `navigator.standalone` is intentionally NOT re-read here: it cannot
 * change during a session (iOS only sets it at launch), so there is
 * nothing to subscribe to. Only the media query can transition live,
 * via its own `change` event.
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

  return standalone;
}

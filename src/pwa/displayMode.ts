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

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => setStandalone(isStandaloneDisplayMode());

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  return standalone;
}

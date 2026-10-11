/**
 * Step 1c. Distinguishes "beforeinstallprompt hasn't fired yet" (Step 1b
 * still applies, keep waiting / show the mandatory native-flow gate)
 * from "this platform will never fire it" (show the instructional
 * Add-to-Home-Screen fallback instead — Step 3e).
 *
 * This is a static capability check, not reactive state: a browser
 * cannot gain or lose the API during a session, so — same reasoning as
 * `isStandaloneDisplayMode` in displayMode.ts — this is a plain
 * function to call once at boot, not a hook with a subscription.
 */

/**
 * True on iOS/iPadOS regardless of which browser shell is used. Every
 * browser on iOS (Safari, Chrome, Firefox, Edge) is a mandated WebKit
 * wrapper under Apple's platform rules, so none of them implement
 * `beforeinstallprompt` — checking the browser, not just the OS, would
 * under-detect "Chrome" on an iPhone as supported when it isn't.
 *
 * iPadOS is the tricky part: since iPadOS 13, `navigator.platform`
 * reports `'MacIntel'`, identical to a real Mac. The disambiguator is
 * touch support — no Mac has `maxTouchPoints > 1`, every iPad does.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;

  const userAgentIsIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIPadOSReportingAsMac =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return userAgentIsIOS || isIPadOSReportingAsMac;
}

/**
 * Feature-detects the Chromium-only `beforeinstallprompt` API. This is
 * the general-purpose signal for "not iOS" cases: present on
 * Chrome/Edge/Samsung Internet (Android and desktop), absent on
 * desktop Safari and Firefox everywhere.
 */
function supportsBeforeInstallPromptEvent(): boolean {
  return typeof window !== 'undefined' && 'onbeforeinstallprompt' in window;
}

export type InstallFlowSupport = 'native' | 'instructional';

/**
 * The single answer Step 4's boot orchestration needs: which of the two
 * InstallPage variants (Step 3d hard gate vs. Step 3e instructions) is
 * even possible on this browser. iOS is checked first and short-circuits
 * to 'instructional' unconditionally, since it's the platform most
 * likely to produce a false positive on the generic feature check.
 */
export function getInstallFlowSupport(): InstallFlowSupport {
  if (isIOS()) return 'instructional';
  return supportsBeforeInstallPromptEvent() ? 'native' : 'instructional';
}

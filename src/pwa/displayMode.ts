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
/**
 * One-shot hint carried across the "Reset this device" navigation (see
 * useDeviceReset.ts) confirming this window WAS standalone right before
 * wipeLocalState() unregistered the service worker — the same event that
 * makes the live display-mode signal likely to misreport `false` for a
 * beat on the very next load (see THE RELOAD BUG below). Reset knows the
 * true answer synchronously, before the unregister happens, and encodes
 * it in the URL it navigates to, rather than making the fresh load
 * re-guess it from a signal that reset itself just made less reliable.
 *
 * Stripped from the URL on first read via replaceState — a one-shot
 * signal for the navigation that carried it, not something that should
 * silently answer every later reload of this page too.
 */
function consumePostResetStandaloneHint(): boolean {
  if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get('notare_reset_standalone') !== '1') return false;

  url.searchParams.delete('notare_reset_standalone');
  window.history.replaceState(null, '', url.toString());
  return true;
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;

  const matchesDisplayModeMediaQuery =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  const iosStandaloneNavigator = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;

  return (
    matchesDisplayModeMediaQuery ||
    iosStandaloneNavigator === true ||
    consumePostResetStandaloneHint()
  );
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
 * Second, later checkpoint alongside STANDALONE_RECHECK_MS — some reloads
 * (notably right after "Reset this device" unregisters the service
 * worker) settle slower than the first recheck's window, so one late
 * checkpoint is kept as a second chance rather than assuming 400ms always
 * covers it.
 */
const STANDALONE_RECHECK_LONG_MS = 1500;

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

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => {
      const next = isStandaloneDisplayMode();
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
    const recheck = () => {
      setStandalone((current) => {
        const rechecked = isStandaloneDisplayMode();
        if (rechecked === current) return current;

        return rechecked;
      });
    };

    const timers = [STANDALONE_RECHECK_MS, STANDALONE_RECHECK_LONG_MS].map((delay) =>
      setTimeout(recheck, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return standalone;
}

/**
 * Persisted counterpart to the in-memory latch below. A React state latch
 * only remembers "installed" for the lifetime of one tab's JS — it says
 * nothing about an ORDINARY reload, a link opened in a fresh tab, or any
 * other load that never re-launches from the home-screen icon. Every one
 * of those is a completely normal way to keep using an app you already
 * installed, and every one of them was, until now, indistinguishable from
 * a first-time visitor who has never installed anything — both get a
 * live `display-mode: standalone` read of `false`, and both got sent to
 * the mandatory InstallPage. This key is what tells them apart: once
 * standalone is EVER confirmed on this browser, that fact outlives the
 * tab, so the install gate — which exists for people who have not
 * installed yet — stops re-litigating it on every single load for
 * someone who plainly already has.
 *
 * "Reset this device" clears all of localStorage by design (hardReset.ts)
 * — a full reset genuinely does start over, and the one navigation that
 * follows it is separately covered by the `notare_reset_standalone` URL
 * hint above, not by this key.
 */
export const EVER_STANDALONE_STORAGE_KEY = 'notare:everStandalone';

function readPersistedEverStandalone(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(EVER_STANDALONE_STORAGE_KEY) === '1';
  } catch {
    // Unavailable in some private-browsing modes — fall back to the live
    // signal only, same as everywhere else in this file.
    return false;
  }
}

function persistEverStandalone(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(EVER_STANDALONE_STORAGE_KEY, '1');
  } catch {
    // Same as above — best-effort, never blocks the in-memory latch.
  }
}

/**
 * Step 8d/10a. Latches useIsStandalone() rather than exposing the live
 * value directly. Two separate call sites need "has this browser ever
 * been confirmed as the installed app" rather than "is it standalone
 * RIGHT NOW":
 *
 *   - useBootPhase.ts: once install is confirmed, a later transient
 *     `false` reading (a known Chrome quirk right after a real install
 *     completes, or an ordinary reload in a ordinary tab) must not eject
 *     someone back onto the mandatory InstallPage.
 *   - App.tsx's UpdateAvailableModal placement: a first-time visitor on
 *     the install gate has nothing installed to update, so the modal
 *     must never appear for them — but once this reads true, it should
 *     keep offering updates even through a later transient blip.
 *
 * Lazy initial value, not `useState(false)`: a cold start that's ALREADY
 * standalone — or was confirmed standalone on a PAST visit — must commit
 * from its very first render, not lag a tick behind an effect that
 * hasn't run yet.
 */
export function useEverStandalone(): boolean {
  const isStandalone = useIsStandalone();
  const [everStandalone, setEverStandalone] = useState(
    () => isStandalone || readPersistedEverStandalone(),
  );

  useEffect(() => {
    // One-directional on purpose — never resets to false.
    if (isStandalone) {
      setEverStandalone(true);
      persistEverStandalone();
    }
  }, [isStandalone]);

  return everStandalone;
}

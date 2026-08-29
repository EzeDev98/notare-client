import { useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { useIsStandalone } from '@/pwa/displayMode';

/**
 * Step 4a. The three-state model App.tsx's AppBoot renders against.
 *
 * A named type + hook rather than the inline boolean AppBoot used
 * directly since Step 2d — that worked for two states, but a third
 * (mandatory InstallPage) needs a real seam other code can be written
 * against before the logic that produces it exists.
 */
export type BootPhase = 'splash' | 'install' | 'ready';

/**
 * Step 4b. Combines Step 1's install-detection with AuthProvider's own
 * init state to compute the real three-way phase.
 *
 * Turns out to need only ONE of Step 1's signals, not all three —
 * worth recording why, since 4a's own doc comment (written before this
 * was worked out) said otherwise:
 *
 *   - isStandaloneDisplayMode() / useIsStandalone() (1a): used below.
 *     This alone answers "is there anything left to install", which is
 *     the only question bootPhase itself needs to answer.
 *   - getInstallAvailability() (1b) and getInstallFlowSupport() (1c):
 *     NOT used here. Both stay exactly where Step 3 already put them —
 *     inside InstallPage itself, deciding which UI to show ONCE the
 *     phase is already 'install' (the native button-with-waiting-state
 *     vs. the instructional steps). Whether beforeinstallprompt has
 *     fired, or ever will, changes nothing about WHETHER installation
 *     is still outstanding — only standalone-or-not answers that.
 *
 * LATCHED, not a raw live read of useIsStandalone() — this was the
 * direct read through Step 4c's own first version, and it turned out to
 * be wrong: `display-mode` is not the monotonic one-way signal that
 * version assumed. Observed directly while testing the native install
 * flow on the dev server: display-mode flipped to standalone right on
 * schedule when the install actually completed, bootPhase correctly
 * moved to 'ready' — and then, ~2 seconds later, with NO reload and NO
 * uninstall in between (same navigation-start timeline throughout, per
 * displayMode.ts's own diagnostic logging), the SAME media query
 * flipped back to non-standalone on its own, as Chrome finished
 * settling the window's real app association. A raw live read sent
 * bootPhase straight back to 'install' for that blip — ejecting someone
 * already let into the app back onto the mandatory gate, for a signal
 * that had nothing to do with them actually losing the installed app.
 *
 * `everStandalone` fixes this by remembering, not re-asking: once
 * useIsStandalone() has read true even once during this page's life,
 * this hook commits to 'ready' (auth permitting) and never reconsiders
 * — a later false reading no longer matters. That's the correct
 * semantics for what this hook is actually answering ("has this session
 * cleared the install requirement"), which can only ever go from
 * unmet to met, never back — a genuine uninstall can only be discovered
 * at the START of a fresh page load (a real cold start, which gets its
 * own fresh `useState(isStandalone)` initial value below, computed from
 * whatever is actually true at THAT moment), never mid-session.
 *
 * Deliberately NOT distinguishing native from instructional here: that
 * split is real (Step 3d vs 3e render very differently) but it's a
 * "how do we get out of install" question, not a "are we in install"
 * question — so it stays inside InstallPage, and this hook only ever
 * has to answer the latter.
 */
export function useBootPhase(): BootPhase {
  const { state } = useAuth();
  const isStandalone = useIsStandalone();

  // Lazy initial value, not `useState(false)`: a cold start that's
  // ALREADY standalone (launched from the installed icon) must commit
  // to 'ready' from its very first render, not lag a tick behind an
  // effect that hasn't run yet.
  const [everStandalone, setEverStandalone] = useState(isStandalone);

  useEffect(() => {
    // One-directional on purpose — see this hook's own doc comment.
    // Never resets to false: a later live `false` reading is exactly
    // the transient blip this latch exists to ignore.
    if (isStandalone) setEverStandalone(true);
  }, [isStandalone]);

  if (state.status === 'initializing') return 'splash';
  if (!everStandalone) return 'install';
  return 'ready';
}

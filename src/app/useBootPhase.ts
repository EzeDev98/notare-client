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
 * The reactive `useIsStandalone()`, not the one-shot
 * `isStandaloneDisplayMode()`: on the native/Chromium path, accepting
 * the install prompt can flip display-mode mid-session without a
 * reload, and this hook needs to notice that and move on to 'ready'
 * without the person having to do anything else (see InstallPage's own
 * "Notare is installed. Continuing…" state, which only ever makes
 * sense if something above it is actually watching for this and
 * following through). On the instructional/iOS path there is no such
 * live transition — this tab's display-mode never flips itself, only
 * a fresh launch from a newly created home-screen icon does — which is
 * exactly why that branch's "Continue" closes the tab instead of
 * waiting for a phase change that will never come in that tab.
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

  if (state.status === 'initializing') return 'splash';
  if (!isStandalone) return 'install';
  return 'ready';
}

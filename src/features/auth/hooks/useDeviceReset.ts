import { useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { attemptFinalSync, wipeLocalState } from '@/app/hardReset';
import { isStandaloneDisplayMode } from '@/pwa/displayMode';

export type DeviceResetConfirmation = 'reset' | 'reset-unsynced' | null;

/**
 * What handleReset shows in place of the confirmation buttons while it runs
 * — a plain status string rather than a boolean, since "syncing" and
 * "erasing" are different enough moments that a single `busy` spinner with
 * no label reads as the app having hung, particularly for the erase step,
 * which can legitimately take a couple of seconds (unregistering the
 * service worker, deleting every cache entry, deleting both databases).
 */
export type DeviceResetStage = 'idle' | 'syncing' | 'erasing';

/**
 * "Reset this device" — a full local teardown (hardReset.ts). Pulled out of
 * SessionsPage into its own hook so the trigger button can live in the
 * sidebar (directly under Accounts) instead: the sidebar only needs a click
 * handler, not the confirm/sync/confirm-again/erase state machine behind
 * it, and this way that state machine has exactly one home regardless of
 * which component ends up rendering the trigger.
 */
export function useDeviceReset() {
  const { state: authState, logout } = useAuth();

  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const [confirmation, setConfirmation] = useState<DeviceResetConfirmation>(null);
  const [busy, setBusy] = useState(false);
  const [resetStage, setResetStage] = useState<DeviceResetStage>('idle');

  function requestReset(): void {
    setConfirmation('reset');
  }

  function closeConfirmation(): void {
    if (busy) return;
    setConfirmation(null);
  }

  /**
   * Reached through TWO confirmations, not one, when there is a reason for
   * a second: the first click ('reset') is the ordinary "are you sure";
   * `attemptFinalSync` runs immediately after it, and only if THAT still
   * leaves unsynced changes behind (this device is offline, or the sync
   * itself failed) does a second, sterner confirmation ('reset-unsynced')
   * ask the person to knowingly discard those specific changes rather than
   * silently doing it for them.
   *
   * `force` is what the second confirmation's own primary action passes —
   * "yes, I understand, erase anyway" — skipping straight to the wipe
   * without re-running the sync attempt a second time.
   */
  async function handleReset(force = false): Promise<void> {
    setBusy(true);

    try {
      if (!force) {
        setResetStage('syncing');
        const { hadUnsyncedChanges } = await attemptFinalSync(ownerId);

        if (hadUnsyncedChanges) {
          setResetStage('idle');
          setConfirmation('reset-unsynced');
          setBusy(false);
          return;
        }
      }

      setResetStage('erasing');

      /*
       * Logout BEFORE the wipe, deliberately — it needs the refresh token
       * that still lives in the auth database to revoke the session on the
       * server. Swallowed the same way AuthProvider's own logout() already
       * does: a person who asked to reset this device must end up reset
       * whether or not the server call succeeded, not stuck mid-reset
       * because their connection dropped at the worst possible moment.
       */
      await logout().catch(() => {
        // See above — local teardown proceeds regardless.
      });

      /*
       * Read BEFORE wipeLocalState() unregisters the service worker —
       * that unregister is exactly the event that can make the live
       * display-mode signal misreport `false` for a beat on the very
       * next load (see displayMode.ts's "RELOAD BUG" comment). Reset
       * knows the true answer right now, synchronously, so it is carried
       * across the navigation below rather than left for the fresh load
       * to re-derive from a signal reset itself is about to disturb.
       */
      const wasStandalone = isStandaloneDisplayMode();

      await wipeLocalState();

      /*
       * A full navigation, not a client-side route change or a plain
       * reload: the service worker registration this tab was controlled
       * by was just unregistered, and only a real navigation guarantees
       * the next request goes to the network rather than a worker that
       * hasn't noticed its own unregistration yet. Landing on "/" rather
       * than staying on whatever page this was is the "clean slate" the
       * reset promises — there is no session left for this URL to mean
       * anything against.
       *
       * The `notare_reset_standalone` hint (consumed once by
       * displayMode.ts) tells the fresh load this window WAS standalone
       * a moment ago, so an already-installed user who just reset never
       * gets bounced onto the mandatory install gate over a stale read.
       */
      window.location.href = wasStandalone ? '/?notare_reset_standalone=1' : '/';
    } finally {
      // Only reached if something above threw before the navigation — the
      // happy path never returns here, since window.location.href = '/'
      // tears this component down along with everything else on the page.
      setBusy(false);
      setResetStage('idle');
      setConfirmation(null);
    }
  }

  return {
    confirmation,
    busy,
    resetStage,
    requestReset,
    closeConfirmation,
    handleReset,
  };
}

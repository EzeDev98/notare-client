/** Runs "Reset this device" step by step. */
import { sessionUserOf } from '@/features/auth/sessionUser';
import { useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { attemptFinalSync, wipeLocalState } from '@/app/hardReset';
import { isStandaloneDisplayMode } from '@/pwa/displayMode';

export type DeviceResetConfirmation = 'reset' | 'reset-unsynced' | null;

export type DeviceResetStage = 'idle' | 'syncing' | 'erasing';

export function useDeviceReset() {
  const { state: authState, logout } = useAuth();

  const ownerId = sessionUserOf(authState)?.id ?? null;

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

      await logout().catch(() => {});

      const wasStandalone = isStandaloneDisplayMode();

      await wipeLocalState();

      window.location.href = wasStandalone ? '/?notare_reset_standalone=1' : '/';
    } finally {
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

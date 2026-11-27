/** Asks before resetting this device. */
import { useEffect, useState } from 'react';

import { attemptFinalSync } from '@/app/hardReset';
import { Button, Overlay, Spinner } from '@/design-system/ui';
import { useDeviceReset } from '@/features/auth/hooks/useDeviceReset';

import { SETTINGS_COPY } from './settingsContent';

const COPY = SETTINGS_COPY.general.reset;

type Check = { phase: 'checking' } | { phase: 'synced' } | { phase: 'waiting'; count: number };

interface ResetDeviceModalProps {
  open: boolean;
  ownerId: number;
  onClose: () => void;
}

export function ResetDeviceModal({ open, ownerId, onClose }: ResetDeviceModalProps) {
  const { busy, handleReset } = useDeviceReset();
  const [check, setCheck] = useState<Check>({ phase: 'checking' });

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setCheck({ phase: 'checking' });
    void attemptFinalSync(ownerId).then((result) => {
      if (cancelled) return;
      setCheck(
        result.hadUnsyncedChanges ? { phase: 'waiting', count: result.unsyncedCount } : { phase: 'synced' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, ownerId]);

  const waiting = check.phase === 'waiting';
  const message =
    check.phase === 'checking' ? COPY.checking : check.phase === 'waiting' ? COPY.waiting(check.count) : COPY.synced;

  return (
    <Overlay
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      dismissible={!busy}
      title={COPY.title}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {SETTINGS_COPY.confirm.cancel}
          </Button>
          <Button
            variant={waiting ? 'danger' : 'primary'}
            disabled={check.phase === 'checking'}
            busy={busy}
            onClick={() => {
              void handleReset(true);
            }}
          >
            {waiting ? COPY.anyway : COPY.ok}
          </Button>
        </>
      }
    >
      <p className="set__note set__note--body">{message}</p>
      {check.phase === 'checking' ? (
        <div className="set__spin">
          <Spinner size="sm" decorative />
        </div>
      ) : null}
    </Overlay>
  );
}

import { useState } from 'react';

import { Button, InfoBanner, Overlay } from '@/design-system/ui';

import { SETTINGS_COPY } from './settingsContent';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  /** Resolves with an error to show inside the modal, or with nothing to close it. */
  onConfirm: () => Promise<string | undefined>;
}

/** One confirmation: the text, Cancel, and the action. Busy while it runs; an error stays inside. */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const close = (): void => {
    if (busy) return;
    setError(undefined);
    onClose();
  };

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    let problem: string | undefined;
    try {
      problem = await onConfirm();
    } catch {
      problem = SETTINGS_COPY.confirm.failed;
    }
    setBusy(false);
    if (problem === undefined) onClose();
    else setError(problem);
  };

  return (
    <Overlay
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={close}>
            {SETTINGS_COPY.confirm.cancel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            busy={busy}
            onClick={() => {
              void confirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="set__stack set__stack--tight">
        <p className="set__note set__note--body">{body}</p>
        {error ? <InfoBanner tone="error">{error}</InfoBanner> : null}
      </div>
    </Overlay>
  );
}

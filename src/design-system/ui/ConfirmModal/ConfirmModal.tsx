/** A modal that asks to confirm an action. */
import { useState } from 'react';

import { Button } from '../Button/Button';
import { InfoBanner } from '../InfoBanner/InfoBanner';
import { Overlay } from '../Overlay/Overlay';

import './ConfirmModal.css';

const CANCEL = 'Cancel';
const FAILED = 'Something went wrong. Try again.';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<string | undefined>;
}

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
      problem = FAILED;
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
            {CANCEL}
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
      <div className="ui-confirm">
        <p className="ui-confirm__body">{body}</p>
        {error ? <InfoBanner tone="error">{error}</InfoBanner> : null}
      </div>
    </Overlay>
  );
}

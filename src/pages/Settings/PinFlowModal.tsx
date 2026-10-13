import { useState } from 'react';

import { useForgotPin } from '@/app/security/useForgotPin';
import { PIN_LENGTH } from '@/core/config/timings';
import { Button, OtpField, Overlay, useToast } from '@/design-system/ui';
import { checkPin, clearPin, savePin } from '@/features/security/pinStore';
import { SECURITY_COPY } from '@/features/security/securityContent';

import './Settings.css';

const COPY = SECURITY_COPY.pin;

export type PinFlowMode = 'create' | 'off' | 'change';
type Step = 'create' | 'confirm' | 'current' | 'next';

interface PinFlowModalProps {
  open: boolean;
  mode: PinFlowMode;
  onClose: () => void;
}

/**
 * The PIN dialogs. Create asks twice. Turn off asks for the current PIN. Change
 * asks for the current PIN, then a new one twice. The parent gives each opening
 * a new `key`, so every opening starts clean.
 */
export function PinFlowModal({ open, mode, onClose }: PinFlowModalProps) {
  const { toast } = useToast();
  const forgot = useForgotPin();
  const [step, setStep] = useState<Step>(mode === 'create' ? 'create' : 'current');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  // A new key remounts the boxes, which puts the cursor back in the first one.
  const [round, setRound] = useState(0);

  const retry = (message: string): void => {
    setValue('');
    setError(message);
    setRound((count) => count + 1);
  };

  const goTo = (next: Step): void => {
    setStep(next);
    setValue('');
    setError('');
    setRound((count) => count + 1);
  };

  const verifyCurrent = async (code: string): Promise<void> => {
    const result = await checkPin(code);
    if (!result.ok) {
      if (result.left <= 0) {
        setLockedOut(true);
        setValue('');
        setError(COPY.lockedOut);
      } else {
        retry(COPY.wrong(result.left));
      }
      return;
    }
    if (mode === 'off') {
      await clearPin();
      toast(COPY.turnedOff);
      onClose();
      return;
    }
    goTo('next');
  };

  const confirmNew = async (code: string): Promise<void> => {
    if (code !== first) {
      retry(COPY.mismatch);
      return;
    }
    await savePin(code);
    toast(mode === 'change' ? COPY.changed : COPY.turnedOn, { tone: 'success' });
    onClose();
  };

  const complete = async (code: string): Promise<void> => {
    setBusy(true);
    try {
      if (step === 'current') await verifyCurrent(code);
      else if (step === 'confirm') await confirmNew(code);
      else {
        setFirst(code);
        goTo('confirm');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay open={open} onClose={onClose} title={COPY[step].title}>
      <div className="set__stack set__stack--tight">
        <p className="set__note set__note--body">{COPY[step].desc}</p>
        <OtpField
          key={round}
          label={COPY.label}
          length={PIN_LENGTH}
          masked
          autoFocus
          value={value}
          error={error}
          disabled={busy || lockedOut}
          onChange={setValue}
          onComplete={(code) => {
            void complete(code);
          }}
        />
        {step === 'current' ? (
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                void forgot();
              }}
            >
              {COPY.forgot}
            </Button>
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}

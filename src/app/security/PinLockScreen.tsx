import { useEffect, useState } from 'react';

import { useTheme } from '@/app/providers/theme-context';
import { PIN_LENGTH } from '@/core/config/timings';
import { Button, Logo, OtpField } from '@/design-system/ui';
import { checkPin, triesLeft } from '@/features/security/pinStore';
import { SECURITY_COPY } from '@/features/security/securityContent';

import './PinLock.css';
import { useForgotPin } from './useForgotPin';

const COPY = SECURITY_COPY.pin;

/**
 * The lock screen. Covers the whole app until the PIN is right. The wrong-PIN
 * count lives on the device (pinStore), so closing the app does not give the
 * tries back, and a lock-out is shown the moment the screen opens.
 */
export function PinLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { resolved } = useTheme();
  const forgot = useForgotPin();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  // A new key remounts the boxes, which puts the cursor back in the first one after a wrong PIN.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void triesLeft().then((left) => {
      if (cancelled || left > 0) return;
      setLockedOut(true);
      setError(COPY.lockedOut);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (code: string): Promise<void> => {
    setBusy(true);
    const result = await checkPin(code);
    setBusy(false);
    if (result.ok) {
      onUnlock();
      return;
    }
    setValue('');
    setAttempt((count) => count + 1);
    if (result.left <= 0) {
      setLockedOut(true);
      setError(COPY.lockedOut);
    } else {
      setError(COPY.wrong(result.left));
    }
  };

  return (
    <div className="pin-lock" role="dialog" aria-modal="true" aria-label={COPY.current.title}>
      <div className="pin-lock__panel">
        <Logo scheme={resolved} size="lg" />
        <div>
          <h1 className="pin-lock__title">{COPY.current.title}</h1>
          <p className="pin-lock__desc">{COPY.current.desc}</p>
        </div>
        <OtpField
          key={attempt}
          label={COPY.label}
          length={PIN_LENGTH}
          masked
          autoFocus
          value={value}
          error={error}
          disabled={busy || lockedOut}
          onChange={setValue}
          onComplete={(code) => {
            void submit(code);
          }}
        />
        <Button
          variant="ghost"
          onClick={() => {
            void forgot();
          }}
        >
          {COPY.forgot}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';

import { PIN_LOCK_DELAY_MS } from '@/core/config/timings';
import { usePinEnabled } from '@/features/security/usePinEnabled';

import './PinLock.css';
import { PinLockScreen } from './PinLockScreen';

/**
 * Puts the PIN lock over the app. The app underneath stays mounted (so a note
 * being typed is not lost) but is inert and covered while the lock shows.
 *
 * It locks when the app opens and when the person returns from the background
 * after PIN_LOCK_DELAY_MS. Turning the PIN on from Settings does not lock at
 * once: the person has just typed it.
 *
 * This is a screen lock, not encryption: the notes in IndexedDB are not
 * touched (decisions.md, D-030).
 */
export function PinGate({ children }: { children: ReactNode }) {
  const pinOn = usePinEnabled();
  const [locked, setLocked] = useState(true);

  // No PIN means nothing to unlock. Settled while rendering, so no frame of the lock shows.
  if (pinOn === false && locked) setLocked(false);

  useEffect(() => {
    if (!pinOn) return undefined;
    let hiddenAt: number | null = null;
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= PIN_LOCK_DELAY_MS) setLocked(true);
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pinOn]);

  const showLock = pinOn !== false && locked;

  return (
    <>
      <div className="pin-gate__app" inert={showLock}>
        {children}
      </div>
      {showLock && pinOn ? (
        <PinLockScreen
          onUnlock={() => {
            setLocked(false);
          }}
        />
      ) : null}
      {showLock && !pinOn ? <div className="pin-lock" aria-hidden="true" /> : null}
    </>
  );
}

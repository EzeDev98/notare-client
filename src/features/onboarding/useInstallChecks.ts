import { useEffect, useState } from 'react';

import { ms } from '@/design-system/motion/motion';
import {
  checkOpensOffline,
  checkPrecache,
  checkStorage,
  resetInstallChecks,
} from '@/pwa/installChecks';

export type CheckKey = 'precache' | 'storage' | 'offline';
export type CheckState = 'pending' | 'passed' | 'failed';

const START: Record<CheckKey, CheckState> = {
  precache: 'pending',
  storage: 'pending',
  offline: 'pending',
};

/** Vitest sets MODE to 'test'. The pause between ticks collapses there. */
const IS_TEST = import.meta.env.MODE === 'test';

const pause = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, IS_TEST ? 0 : ms('--motion-reveal'));
  });

/**
 * Runs the three install checks (10d), one after another, and reports each as
 * pending, passed or failed. A line never ticks before its answer is in, and
 * never ticks at all unless the answer was yes. Each line is shown for at least
 * one beat, so a fast answer does not flash by unread.
 *
 * `storageRefused`: storage is available but the browser would not promise to
 * keep it, which the screen explains in a note.
 */
export function useInstallChecks(): {
  checks: Record<CheckKey, CheckState>;
  settled: boolean;
  storageRefused: boolean;
} {
  const [checks, setChecks] = useState(START);
  const [storageRefused, setStorageRefused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resetInstallChecks();

    const finish = async (key: CheckKey, passed: Promise<boolean>): Promise<void> => {
      const [ok] = await Promise.all([passed.catch(() => false), pause()]);
      if (!cancelled) setChecks((prev) => ({ ...prev, [key]: ok ? 'passed' : 'failed' }));
    };

    void (async () => {
      await finish('precache', checkPrecache());
      await finish(
        'storage',
        checkStorage().then(({ available, persisted }) => {
          if (!cancelled) setStorageRefused(available && !persisted);
          return available;
        }),
      );
      await finish('offline', checkOpensOffline());
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { checks, settled: Object.values(checks).every((s) => s !== 'pending'), storageRefused };
}

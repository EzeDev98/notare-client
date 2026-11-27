/** Runs the checks shown while the app installs. */
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

const IS_TEST = import.meta.env.MODE === 'test';

const pause = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, IS_TEST ? 0 : ms('--motion-reveal'));
  });

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

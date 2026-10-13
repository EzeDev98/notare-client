import { useEffect, useState } from 'react';

import { clipRepository } from '@/features/notes/local/clipRepository';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

export interface StorageUse {
  used: number;
  quota: number;
  percent: number;
}

/**
 * Space on this device: the voice-clip bytes (live) and the browser's estimate of
 * what Notare uses of its quota. The estimate is null where the browser cannot give one.
 */
export function useStorage(): { clipBytes: number; use: StorageUse | null } {
  const clipBytes = useStableLiveQuery(() => clipRepository.audioBytes(), [], 0);
  const [use, setUse] = useState<StorageUse | null>(null);

  useEffect(() => {
    if (!('storage' in navigator)) return undefined;
    let cancelled = false;
    navigator.storage
      .estimate()
      .then(({ usage = 0, quota = 0 }) => {
        if (cancelled || quota === 0) return;
        setUse({ used: usage, quota, percent: Math.round((usage / quota) * 100) });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clipBytes]);

  return { clipBytes, use };
}

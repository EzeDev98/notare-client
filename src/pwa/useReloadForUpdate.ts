import { useState } from 'react';

import { UPDATE_RELOAD_GIVE_UP_MS } from '@/core/config/timings';
import { done } from '@/design-system/motion/motion';
import { fadeOut } from '@/design-system/motion/patterns';
import { clearUpdateReload, markUpdateReload } from '@/pwa/updateReload';
import { useServiceWorkerUpdate } from '@/pwa/useServiceWorkerUpdate';

/**
 * The Reload button of the Update available banner: the screen fades out, the waiting
 * worker takes over, and the page reloads by itself. The start-up splash then fades the
 * new version in. If the reload never comes, the screen is given back.
 */
export function useReloadForUpdate(): { available: boolean; reloading: boolean; reload: () => Promise<void> } {
  const { available, applyUpdate } = useServiceWorkerUpdate();
  const [reloading, setReloading] = useState(false);

  const reload = async (): Promise<void> => {
    if (reloading) return;
    setReloading(true);
    const root = document.getElementById('root');
    const fade = root ? fadeOut(root) : null;
    if (fade) await done(fade);
    markUpdateReload();
    applyUpdate();
    window.setTimeout(() => {
      fade?.cancel();
      clearUpdateReload();
      setReloading(false);
    }, UPDATE_RELOAD_GIVE_UP_MS);
  };

  return { available, reloading, reload };
}

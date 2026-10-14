import { useState, useSyncExternalStore } from 'react';

import { UPDATE_RELOAD_GIVE_UP_MS } from '@/core/config/timings';
import { Button, Overlay } from '@/design-system/ui';
import { getUpdateRequired, subscribeUpdateRequired } from '@/lib/http/updateRequired';
import { applyUpdate, checkForUpdates } from '@/pwa/registerServiceWorker';
import { UPDATE_COPY } from '@/pwa/updateContent';
import { markUpdateReload } from '@/pwa/updateReload';

/**
 * "Update required" (master 6.7): the server said this version is too old (HTTP 426).
 * It cannot be dismissed. Reload looks for a new version first, so it actually updates.
 * Nothing is lost: queued notes stay on the device.
 *
 * Mounted outside AuthProvider in App.tsx: the server can say it whether or not anyone is signed in.
 */
export function UpdateRequiredModal() {
  const required = useSyncExternalStore(subscribeUpdateRequired, getUpdateRequired);
  const [busy, setBusy] = useState(false);

  const reload = async (): Promise<void> => {
    setBusy(true);
    try {
      if ((await checkForUpdates()) === 'available') {
        markUpdateReload();
        applyUpdate();
        window.setTimeout(() => {
          setBusy(false);
        }, UPDATE_RELOAD_GIVE_UP_MS);
        return;
      }
    } catch {
      // The check could not run (offline). Reload anyway; the app shell comes from the cache.
    }
    window.location.reload();
  };

  return (
    <Overlay
      open={required}
      dismissible={false}
      onClose={() => undefined}
      title={UPDATE_COPY.required.title}
      footer={
        <Button
          variant="primary"
          busy={busy}
          onClick={() => {
            void reload();
          }}
        >
          {UPDATE_COPY.reload}
        </Button>
      }
    >
      <p>{UPDATE_COPY.required.body}</p>
    </Overlay>
  );
}

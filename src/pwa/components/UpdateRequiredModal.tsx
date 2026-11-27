/** "Update required" when the server needs a newer app. */
import { useState, useSyncExternalStore } from 'react';

import { UPDATE_RELOAD_GIVE_UP_MS } from '@/core/config/timings';
import { Button, Overlay } from '@/design-system/ui';
import { getUpdateRequired, subscribeUpdateRequired } from '@/lib/http/updateRequired';
import { applyUpdate, checkForUpdates } from '@/pwa/registerServiceWorker';
import { UPDATE_COPY } from '@/pwa/updateContent';
import { markUpdateReload } from '@/pwa/updateReload';

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
    } catch {}
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

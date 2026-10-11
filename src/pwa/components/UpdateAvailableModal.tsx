import { useEffect, useState } from 'react';

import { Button, Overlay } from '@/design-system/ui';
import { UPDATE_COPY } from '@/pwa/updateContent';
import { useServiceWorkerUpdate } from '@/pwa/useServiceWorkerUpdate';

/**
 * The visible half of the update flow (11D). A new service worker is waiting;
 * Reload tells it to take over, and the page reloads once it has.
 *
 * Closing it (Close, Escape, a click outside) hides it for this waiting worker
 * only. When a NEWER worker replaces it, `available` drops and returns, which
 * resets the dismissal so the newer build gets its own prompt. The blocking
 * "Update required" version comes in step 14.
 *
 * Mounted outside AuthProvider in App.tsx: an update is offerable whether or
 * not anyone is signed in, once this session is the installed app.
 */
export function UpdateAvailableModal() {
  const { available, applyUpdate } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!available) setDismissed(false);
  }, [available]);

  return (
    <Overlay
      open={available && !dismissed}
      onClose={() => {
        setDismissed(true);
      }}
      title={UPDATE_COPY.title}
      footer={
        <Button variant="primary" onClick={applyUpdate}>
          {UPDATE_COPY.reload}
        </Button>
      }
    >
      <p>{UPDATE_COPY.body}</p>
    </Overlay>
  );
}

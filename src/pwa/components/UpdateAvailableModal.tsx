import { useEffect, useState } from 'react';
import { MagicIcon } from '@patternfly/react-icons';

import { Modal } from '@/design-system/components/Modal/Modal';
import { useServiceWorkerUpdate } from '@/pwa/useServiceWorkerUpdate';

/**
 * 11D's visible half, replacing the old UpdateBanner. Same underlying
 * signal (useServiceWorkerUpdate — a waiting service worker registered
 * itself via registerServiceWorker.ts's onUpdateAvailable), just asked for
 * with the app's standard confirmation Modal instead of a persistent
 * inline banner — a deliberate product choice for something that should
 * interrupt and be noticed, not something to leave people free to ignore
 * indefinitely the way the banner did.
 *
 * Mounted outside AuthProvider in App.tsx, same as the banner was — an
 * update is offerable whether or not anyone is signed in (the login
 * screen itself is served by the same service worker).
 *
 * `dismissed` is local, resettable state, not a permanent "don't ask
 * again": clicking "Later" (or Escape, or the backdrop) hides the modal
 * for the rest of THIS waiting worker's lifetime, but the moment
 * `available` goes back to false and then true again — the only way that
 * happens is a NEWER worker replacing the one that was waiting when they
 * dismissed — dismissed resets, so the newer update gets its own prompt
 * rather than silently inheriting a decision made about a different
 * build. Reloading the app (including the reload applyUpdate() itself
 * triggers) also clears it for free, being a fresh mount.
 */
export function UpdateAvailableModal() {
  const { available, applyUpdate } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!available) setDismissed(false);
  }, [available]);

  if (!available || dismissed) return null;

  function dismiss() {
    setDismissed(true);
  }

  return (
    <Modal
      icon={<MagicIcon aria-hidden="true" />}
      title="A new version of Notare is available"
      description="Update now for the latest features and fixes. Your notes are saved automatically, so it's safe to update anytime."
      primaryAction={{ label: 'Update now', onClick: applyUpdate }}
      secondaryAction={{ label: 'Later', onClick: dismiss }}
      onClose={dismiss}
    />
  );
}

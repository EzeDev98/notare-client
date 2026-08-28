import { useState } from 'react';

import { useInstallPrompt } from '@/pwa/useInstallPrompt';
import { Button } from '@/design-system/components/Button/Button';
import './InstallBanner.css';

/**
 * The visible half of installPrompt.ts. Same placement reasoning as
 * UpdateBanner: mounted outside AuthProvider in App.tsx, since install
 * is offerable whether or not anyone is signed in.
 *
 * Dismissing hides the banner for this page load only (`dismissed`
 * local state) — it does not call anything from installPrompt.ts, so
 * the captured event is still available if the person changes their
 * mind and finds another way to trigger it later. Reload gets a fresh
 * `beforeinstallprompt` anyway per spec, so nothing needs to persist
 * across sessions here.
 *
 * iOS Safari never fires `beforeinstallprompt`, so `available` is
 * always false there and this renders nothing — iOS install guidance
 * (Share → Add to Home Screen) is a separate, still-open piece of work,
 * not something this component can trigger programmatically.
 */
export function InstallBanner() {
  const { available, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!available || dismissed) return null;

  return (
    <div className="install-banner" role="status">
      <span className="install-banner__text">Install Notare for quick access and offline use.</span>
      <div className="install-banner__actions">
        <Button variant="secondary" size="sm" onClick={() => setDismissed(true)}>
          Not now
        </Button>
        <Button variant="primary" size="sm" onClick={promptInstall}>
          Install
        </Button>
      </div>
    </div>
  );
}

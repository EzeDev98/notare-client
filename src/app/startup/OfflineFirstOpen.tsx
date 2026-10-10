import { useState } from 'react';

import { useTheme } from '@/app/providers/theme-context';
import { Button, InfoBanner, Logo } from '@/design-system/ui';

import { STARTUP_COPY } from './startupContent';

import './OfflineFirstOpen.css';

/**
 * First open on a device with no session, no cached notes and no connection
 * (master 6.7). Nothing else can work yet, so this is the whole screen.
 * "Try again" asks start-up to decide again; if the connection is still down
 * it says so and stays.
 */
export function OfflineFirstOpen({ onRetry }: { onRetry: () => Promise<boolean> }) {
  const { resolved } = useTheme();
  const [busy, setBusy] = useState(false);
  const [stillOffline, setStillOffline] = useState(false);

  async function retry() {
    if (busy) return;
    setBusy(true);
    const connected = await onRetry();
    setBusy(false);
    setStillOffline(!connected);
  }

  return (
    <main className="startup-offline">
      <div className="startup-offline__inner">
        <Logo scheme={resolved} size="lg" />
        <div className="startup-offline__text">
          <h1 className="startup-offline__title">{STARTUP_COPY.offlineTitle}</h1>
          <p>{STARTUP_COPY.offlineText}</p>
        </div>
        {stillOffline ? <InfoBanner tone="error">{STARTUP_COPY.stillOffline}</InfoBanner> : null}
        <Button variant="primary" busy={busy} onClick={() => void retry()}>
          {STARTUP_COPY.offlineRetry}
        </Button>
      </div>
    </main>
  );
}

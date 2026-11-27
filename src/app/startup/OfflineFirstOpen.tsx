/** Shown on a first open with no session, no notes and no connection. */
import { useState } from 'react';

import { useTheme } from '@/app/providers/theme-context';
import { OFFLINE_RETRY_MIN_BUSY_MS } from '@/core/config/timings';
import { Button, InfoBanner, Logo } from '@/design-system/ui';
import { wait } from '@/lib/wait';

import { STARTUP_COPY } from './startupContent';

import './OfflineFirstOpen.css';

export function OfflineFirstOpen({ onRetry }: { onRetry: () => Promise<boolean> }) {
  const { resolved } = useTheme();
  const [busy, setBusy] = useState(false);
  const [stillOffline, setStillOffline] = useState(false);

  async function retry() {
    if (busy) return;
    setBusy(true);
    const [connected] = await Promise.all([onRetry(), wait(OFFLINE_RETRY_MIN_BUSY_MS)]);
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

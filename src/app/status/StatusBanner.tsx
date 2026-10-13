import { useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { SYNC_NOW_MIN_BUSY_MS } from '@/core/config/timings';
import { BannerSlot, Button, InfoBanner, useToast } from '@/design-system/ui';
import { sessionUserOf } from '@/features/auth/sessionUser';
import { useStorageFull } from '@/features/notes/status/storageFull';
import { FreeUpSpaceModal } from '@/pages/Settings/FreeUpSpaceModal';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { requestSync } from '@/sync/engine';
import { getSyncStatus, isSyncPaused } from '@/sync/syncStatus';
import { useSyncStatus } from '@/sync/useSyncStatus';

import { SignInAgainModal } from './SignInAgainModal';
import { STATUS_COPY } from './statusContent';

interface Condition {
  key: string;
  tone?: 'brand' | 'error';
  title: string;
  body: string;
  action: string;
  busy?: boolean | undefined;
  onAction: () => void;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * The one banner for every persistent condition (O-11, step 14). It sits in a
 * reserved slot under the header, so a banner appearing or going moves nothing,
 * and it shows only the most important condition.
 *
 * Add a condition by pushing it in priority order below. The prototype's order,
 * most important first: sharing stopped, device full, sync paused, session
 * expired, update available. Later steps add theirs above this one.
 */
export function StatusBanner() {
  const { state } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const online = useOnlineStatus();
  const sync = useSyncStatus();
  const { toast } = useToast();
  const [retrying, setRetrying] = useState(false);
  const storageFull = useStorageFull();
  const [freeOpen, setFreeOpen] = useState(false);

  // Retry keeps the button busy for at least a second, then reports what happened (14b).
  const retrySync = async (): Promise<void> => {
    if (retrying) return;
    setRetrying(true);
    await Promise.all([requestSync('manual-retry').catch(() => undefined), wait(SYNC_NOW_MIN_BUSY_MS)]);
    setRetrying(false);
    if (isSyncPaused(getSyncStatus())) {
      toast(STATUS_COPY.syncPaused.stillFailing, { tone: 'error' });
    } else {
      toast(STATUS_COPY.syncPaused.recovered, { tone: 'success' });
    }
  };

  const conditions: Condition[] = [];

  // Device full (14c): above sync paused, because nothing can be saved at all.
  if (storageFull) {
    conditions.push({
      key: 'device-full',
      tone: 'error',
      ...STATUS_COPY.deviceFull,
      onAction: () => {
        setFreeOpen(true);
      },
    });
  }

  if (state.status !== 'session-expired' && online && isSyncPaused(sync)) {
    conditions.push({
      key: 'sync-paused',
      tone: 'error',
      ...STATUS_COPY.syncPaused,
      busy: retrying,
      onAction: () => {
        void retrySync();
      },
    });
  }

  if (state.status === 'session-expired' && sessionUserOf(state) !== null) {
    conditions.push({
      key: 'session-expired',
      ...STATUS_COPY.sessionExpired,
      onAction: () => {
        setSignInOpen(true);
      },
    });
  }

  const shown = conditions[0];

  return (
    <>
      <BannerSlot>
        {shown ? (
          <InfoBanner
            key={shown.key}
            {...(shown.tone ? { tone: shown.tone } : {})}
            title={shown.title}
            action={
              <Button variant="secondary" busy={shown.busy === true} onClick={shown.onAction}>
                {shown.action}
              </Button>
            }
          >
            {shown.body}
          </InfoBanner>
        ) : null}
      </BannerSlot>
      <FreeUpSpaceModal
        open={freeOpen}
        onClose={() => {
          setFreeOpen(false);
        }}
      />
      <SignInAgainModal
        open={signInOpen}
        onClose={() => {
          setSignInOpen(false);
        }}
      />
    </>
  );
}

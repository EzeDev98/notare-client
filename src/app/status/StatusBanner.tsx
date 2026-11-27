/** The banner under the header for offline, paused sync, full storage and similar states. */
import { useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { BannerSlot, Button, InfoBanner } from '@/design-system/ui';
import { sessionUserOf } from '@/features/auth/sessionUser';
import { useStorageFull } from '@/features/notes/status/storageFull';
import { FreeUpSpaceModal } from '@/pages/Settings/FreeUpSpaceModal';
import { getUpdateRequired, subscribeUpdateRequired } from '@/lib/http/updateRequired';
import { UPDATE_COPY } from '@/pwa/updateContent';
import { useReloadForUpdate } from '@/pwa/useReloadForUpdate';

import { SignInAgainModal } from './SignInAgainModal';
import { STATUS_COPY } from './statusContent';

interface Condition {
  key: string;
  tone?: 'brand' | 'error';
  title?: string;
  body: string;
  action?: string;
  busy?: boolean | undefined;
  onAction?: () => void;
}

const PRIORITY: readonly string[] = ['session-expired', 'device-full', 'update-available'];

const rank = (key: string): number => {
  const at = PRIORITY.indexOf(key);
  return at === -1 ? PRIORITY.length : at;
};

export function StatusBanner() {
  const { state } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const storageFull = useStorageFull();
  const [freeOpen, setFreeOpen] = useState(false);
  const update = useReloadForUpdate();
  const updateRequired = useSyncExternalStore(subscribeUpdateRequired, getUpdateRequired);

  const conditions: Condition[] = [];

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

  if (state.status === 'session-expired' && sessionUserOf(state) !== null) {
    conditions.push({
      key: 'session-expired',
      ...STATUS_COPY.sessionExpired,
      onAction: () => {
        setSignInOpen(true);
      },
    });
  }

  if (update.available) {
    conditions.push({
      key: 'update-available',
      title: UPDATE_COPY.title,
      body: UPDATE_COPY.body,
      action: UPDATE_COPY.reload,
      busy: update.reloading,
      onAction: () => {
        void update.reload();
      },
    });
  }

  const shown = updateRequired ? undefined : [...conditions].sort((a, b) => rank(a.key) - rank(b.key))[0];

  return (
    <>
      <BannerSlot>
        {shown ? (
          <InfoBanner
            key={shown.key}
            {...(shown.tone ? { tone: shown.tone } : {})}
            title={shown.title}
            action={
              shown.action !== undefined && shown.onAction !== undefined ? (
                <Button variant="secondary" busy={shown.busy === true} onClick={shown.onAction}>
                  {shown.action}
                </Button>
              ) : undefined
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

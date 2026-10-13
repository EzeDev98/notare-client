import { useEffect, useState } from 'react';

import { useSessionUser } from '@/app/shell/useSessionUser';
import { SYNC_NOW_MIN_BUSY_MS, STORAGE_NEAR_FULL_PERCENT } from '@/core/config/timings';
import {
  Button,
  Card,
  Checkbox,
  DetailRow,
  InfoBanner,
  PageHeader,
  ProgressBar,
  ScreenContainer,
  useToast,
} from '@/design-system/ui';
import type { CurrentUser } from '@/features/auth/types';
import { formatBytes } from '@/lib/formatBytes';
import { getWifiOnly, setWifiOnly } from '@/features/notes/local/clipDownloadPolicy';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { setStorageFull, useStorageFull } from '@/features/notes/status/storageFull';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { requestSync } from '@/sync/engine';
import { getSyncStatus } from '@/sync/syncStatus';

import { ConfirmModal } from './ConfirmModal';
import { ResetDeviceModal } from './ResetDeviceModal';
import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { SettingsSection } from './SettingsSection';
import { useBackToHub } from './useBackToHub';
import { useLastSynced } from './useLastSynced';
import { useStorage } from './useStorage';
import { useSyncSummary } from './useSyncSummary';

const COPY = SETTINGS_COPY.syncStorage;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function SyncAndStorage({ user }: { user: CurrentUser }) {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const { toast } = useToast();
  const offline = useOffline();
  const { word, counts } = useSyncSummary(user.id);
  const lastSynced = useLastSynced();
  const { clipBytes, use } = useStorage();
  const storageFull = useStorageFull();
  const nearlyFull = storageFull || (use?.percent ?? 0) >= STORAGE_NEAR_FULL_PERCENT;

  const [syncing, setSyncing] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [wifiOnly, setWifi] = useState(false);

  useEffect(() => {
    void getWifiOnly().then(setWifi);
  }, []);

  const syncNow = async (): Promise<void> => {
    setSyncing(true);
    await Promise.all([requestSync('manual').catch(() => undefined), wait(SYNC_NOW_MIN_BUSY_MS)]);
    setSyncing(false);
    const { status } = getSyncStatus();
    if (status === 'offline' || status === 'error') toast(COPY.cannotReach, { tone: 'error' });
    else toast(COPY.synced, { tone: 'success' });
  };

  const freeUp = async (): Promise<string | undefined> => {
    const freed = await clipRepository.releaseSyncedAudio();
    if (freed > 0) setStorageFull(false);
    toast(COPY.free.done(formatBytes(freed)), { tone: 'success' });
    return undefined;
  };

  return (
    <ScreenContainer placement="top" bar={<PageHeader title={COPY.title} onBack={back} />}>
      <div className="set__stack">
        {offline || nearlyFull ? (
          <div className="set__banners">
            {offline ? <InfoBanner>{COPY.offlineBanner}</InfoBanner> : null}
            {nearlyFull ? (
              <InfoBanner
                tone="error"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFreeOpen(true);
                    }}
                  >
                    {COPY.freeUp}
                  </Button>
                }
              >
                {COPY.full}
              </InfoBanner>
            ) : null}
          </div>
        ) : null}

        <SettingsSection heading={COPY.syncHeading}>
          <Card>
            <DetailRow label={COPY.status}>{word}</DetailRow>
            <DetailRow label={COPY.lastSynced}>{lastSynced}</DetailRow>
            <DetailRow label={COPY.notesOnDevice}>{String(counts.all + counts.archived)}</DetailRow>
          </Card>
          <div className="set__gap">
            <Button
              variant="secondary"
              busy={syncing}
              onClick={() => {
                void syncNow();
              }}
            >
              {COPY.syncNow}
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection heading={COPY.storageHeading}>
          <Card>
            {use ? (
              <div className="set__bar">
                <ProgressBar value={use.percent} label={COPY.storageLabel} />
                <p className="set__note">{COPY.storageOf(formatBytes(use.used), formatBytes(use.quota))}</p>
              </div>
            ) : null}
            <DetailRow label={COPY.voiceClips}>{formatBytes(clipBytes)}</DetailRow>
          </Card>
          <div className="set__gap">
            <Button
              variant="secondary"
              disabled={clipBytes === 0}
              onClick={() => {
                setFreeOpen(true);
              }}
            >
              {COPY.freeUp}
            </Button>
          </div>
        </SettingsSection>

        <div>
          <Checkbox
            label={COPY.wifi.label}
            hint={COPY.wifi.hint}
            checked={wifiOnly}
            onChange={(event) => {
              setWifi(event.target.checked);
              void setWifiOnly(event.target.checked);
            }}
          />
        </div>

        <SettingsSection heading={COPY.reset.heading}>
          <p className="set__note">{COPY.reset.note}</p>
          <div className="set__gap">
            <Button
              variant="danger"
              onClick={() => {
                setResetOpen(true);
              }}
            >
              {COPY.reset.button}
            </Button>
          </div>
        </SettingsSection>
      </div>

      <ConfirmModal
        open={freeOpen}
        title={COPY.free.title}
        body={COPY.free.body}
        confirmLabel={COPY.free.confirm}
        onClose={() => {
          setFreeOpen(false);
        }}
        onConfirm={freeUp}
      />
      <ResetDeviceModal
        open={resetOpen}
        ownerId={user.id}
        onClose={() => {
          setResetOpen(false);
        }}
      />
    </ScreenContainer>
  );
}

/** Settings > Sync and storage (master 6.6, 6.6.1): sync status, space on this device, reset. */
export function SettingsSyncPage() {
  const user = useSessionUser();
  return user ? <SyncAndStorage user={user} /> : null;
}

import { useEffect, useState } from 'react';

import { useSessionUser } from '@/app/shell/useSessionUser';
import { SYNC_NOW_MIN_BUSY_MS, STORAGE_NEAR_FULL_PERCENT } from '@/core/config/timings';
import {
  Button,
  Card,
  ConfirmModal,
  DetailRow,
  InfoBanner,
  PageHeader,
  ProgressBar,
  ScreenContainer,
  useToast,
} from '@/design-system/ui';
import type { CurrentUser } from '@/features/auth/types';
import { formatBytes } from '@/lib/formatBytes';
import { isOffline } from '@/lib/http/errors';
import { META_KEYS } from '@/features/notes/local/metaRow';
import { metaRepository } from '@/features/notes/local/metaRepository';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { setStorageFull, useStorageFull } from '@/features/notes/status/storageFull';
import { applyUpdate, checkForUpdates, onUpdateAvailable } from '@/pwa/registerServiceWorker';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useNow } from '@/shared/hooks/useNow';
import { requestSync } from '@/sync/engine';
import { getSyncStatus } from '@/sync/syncStatus';

import { ago } from './ago';
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
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [freeOpen, setFreeOpen] = useState(false);
  const now = useNow();
  const [checking, setChecking] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  useEffect(() => onUpdateAvailable(setUpdateReady), []);

  useEffect(() => {
    void metaRepository.get<number>(META_KEYS.updateCheckedAt).then((value) => {
      if (typeof value === 'number') setCheckedAt(value);
    });
  }, []);

  const syncNow = async (): Promise<void> => {
    setSyncing(true);
    setSyncResult(null);
    await Promise.all([requestSync('manual').catch(() => undefined), wait(SYNC_NOW_MIN_BUSY_MS)]);
    setSyncing(false);
    const { status } = getSyncStatus();
    setSyncResult(status === 'offline' || status === 'error' ? COPY.cannotReach : COPY.synced);
  };

  const checkUpdates = async (): Promise<void> => {
    setChecking(true);
    try {
      const result = await checkForUpdates();
      const stamp = Date.now();
      setCheckedAt(stamp);
      await metaRepository.set(META_KEYS.updateCheckedAt, stamp);
      if (result === 'latest') toast(COPY.update.latest, { tone: 'success' });
    } catch (reason) {
      toast(isOffline(reason) ? COPY.cannotReach : SETTINGS_COPY.confirm.failed, { tone: 'error' });
    } finally {
      setChecking(false);
    }
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

        <SettingsSection centered heading={COPY.syncHeading}>
          <Card>
            <DetailRow label={COPY.status}>{word}</DetailRow>
            <DetailRow label={COPY.lastSynced}>{lastSynced}</DetailRow>
            <DetailRow label={COPY.notesOnDevice}>{String(counts.all)}</DetailRow>
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
          {syncResult ? (
            <p className="set__note" role="status">
              {syncResult}
            </p>
          ) : null}
        </SettingsSection>

        <SettingsSection centered heading={COPY.storageHeading}>
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

        <SettingsSection centered heading={COPY.update.heading}>
          {updateReady ? (
            <InfoBanner
              title={COPY.update.title}
              action={
                <Button variant="secondary" onClick={applyUpdate}>
                  {COPY.update.reload}
                </Button>
              }
            >
              {COPY.update.body}
            </InfoBanner>
          ) : null}
          <Card>
            <DetailRow label={COPY.update.version}>{__APP_VERSION__}</DetailRow>
            <DetailRow label={COPY.update.lastChecked}>
              {checkedAt === null ? COPY.update.never : ago(checkedAt, now)}
            </DetailRow>
          </Card>
          <div className="set__gap">
            <Button
              variant="secondary"
              busy={checking}
              onClick={() => {
                void checkUpdates();
              }}
            >
              {COPY.update.check}
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
    </ScreenContainer>
  );
}

/** Settings > Sync and storage (master 6.6, 6.6.1): sync status, storage and app version. */
export function SettingsSyncPage() {
  const user = useSessionUser();
  return user ? <SyncAndStorage user={user} /> : null;
}

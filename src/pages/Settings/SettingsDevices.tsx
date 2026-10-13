import { useState } from 'react';

import {
  Button,
  Card,
  DeviceRow,
  InfoBanner,
  PageHeader,
  ScreenContainer,
  Spinner,
  useToast,
} from '@/design-system/ui';
import { useSessions } from '@/features/auth/hooks/useSessions';
import type { SessionResponse } from '@/features/auth/types';
import { isOffline } from '@/lib/http/errors';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useNow } from '@/shared/hooks/useNow';

import { ago } from './ago';
import { ConfirmModal } from './ConfirmModal';
import { deviceName } from './deviceName';
import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { useBackToHub } from './useBackToHub';

const COPY = SETTINGS_COPY.devices;

/** The message for a failed request: offline gets its own words. */
const failure = (reason: unknown): string =>
  isOffline(reason) ? SETTINGS_COPY.syncStorage.cannotReach : SETTINGS_COPY.confirm.failed;

/** Settings > Devices (master 6.6.1): every signed-in device, and a way to sign the others out. */
export function SettingsDevicesPage() {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const { toast } = useToast();
  const now = useNow();
  const { sessions, error, reload, revoke } = useSessions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);

  const others = sessions?.filter((session) => !session.current) ?? [];

  const signOut = async (session: SessionResponse): Promise<void> => {
    setBusyId(session.sessionId);
    try {
      await revoke(session.sessionId);
      toast(COPY.signedOut(deviceName(session.userAgent)), { tone: 'success' });
    } catch (reason) {
      toast(failure(reason), { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const signOutOthers = async (): Promise<string | undefined> => {
    const results = await Promise.allSettled(others.map((session) => revoke(session.sessionId)));
    const done = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (done > 0) toast(COPY.signedOutOthers(done), { tone: 'success' });
    return failed ? failure(failed.reason) : undefined;
  };

  return (
    <ScreenContainer placement="top" bar={<PageHeader title={COPY.title} onBack={back} />}>
      <div className="set__stack">
        {error ? (
          <InfoBanner
            tone="error"
            action={
              <Button variant="secondary" onClick={reload}>
                {COPY.retry}
              </Button>
            }
          >
            {error}
          </InfoBanner>
        ) : null}

        {sessions ? (
          <>
            <Card className="set__card">
              {[...sessions]
                .sort((a, b) => Number(b.current) - Number(a.current))
                .map((session) => (
                  <DeviceRow
                    key={session.sessionId}
                    name={deviceName(session.userAgent)}
                    lastSeen={session.current ? COPY.activeNow : ago(Date.parse(session.lastUsedAt), now)}
                    current={session.current}
                    busy={busyId === session.sessionId}
                    onSignOut={() => {
                      void signOut(session);
                    }}
                  />
                ))}
            </Card>
            <div>
              <Button
                variant="secondary"
                disabled={others.length === 0}
                onClick={() => {
                  setOthersOpen(true);
                }}
              >
                {COPY.everywhere}
              </Button>
            </div>
            <p className="set__note">{COPY.limit}</p>
          </>
        ) : error ? null : (
          <div className="set__spin">
            <Spinner />
          </div>
        )}
      </div>

      <ConfirmModal
        open={othersOpen}
        title={COPY.confirm.title}
        body={COPY.confirm.body}
        confirmLabel={COPY.confirm.confirm}
        onClose={() => {
          setOthersOpen(false);
        }}
        onConfirm={signOutOthers}
      />
    </ScreenContainer>
  );
}

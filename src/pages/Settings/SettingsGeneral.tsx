import { useEffect, useState } from 'react';

import { useSessionUser } from '@/app/shell/useSessionUser';
import { Button, Checkbox, PageHeader, ScreenContainer } from '@/design-system/ui';
import { useAiTidySetting } from '@/features/aiTidy/hooks/useAiTidySetting';
import type { CurrentUser } from '@/features/auth/types';
import { getWifiOnly, setWifiOnly } from '@/features/notes/local/clipDownloadPolicy';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { ResetDeviceModal } from './ResetDeviceModal';
import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { SettingsSection } from './SettingsSection';
import { useBackToHub } from './useBackToHub';

const COPY = SETTINGS_COPY.general;

function GeneralSettings({ user }: { user: CurrentUser }) {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const aiTidy = useAiTidySetting();
  const [wifiOnly, setWifi] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    void getWifiOnly().then(setWifi);
  }, []);

  return (
    <ScreenContainer placement="top" bar={<PageHeader title={COPY.title} onBack={back} />}>
      <div className="set__stack">
        {aiTidy.enabled === undefined ? null : (
          <div>
            <Checkbox
              label={COPY.aiTidy.label}
              hint={COPY.aiTidy.hint}
              checked={aiTidy.enabled}
              disabled={aiTidy.saving}
              onChange={(event) => {
                aiTidy.setEnabled(event.target.checked);
              }}
            />
          </div>
        )}

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

/** Settings: AI tidy, Wi-Fi-only clip downloads, and resetting this device. */
export function SettingsGeneralPage() {
  const user = useSessionUser();
  return user ? <GeneralSettings user={user} /> : null;
}

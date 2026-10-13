import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { FEATURES } from '@/core/config/features';
import { Button, Checkbox, PageHeader, ScreenContainer } from '@/design-system/ui';
import { SECURITY_COPY } from '@/features/security/securityContent';
import { usePinEnabled } from '@/features/security/usePinEnabled';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { PinFlowModal, type PinFlowMode } from './PinFlowModal';
import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { SettingsSection } from './SettingsSection';
import { useBackToHub } from './useBackToHub';

const COPY = SECURITY_COPY;

/** Settings > Security (master 6.6): the PIN lock, and Change password once its server call exists. */
export function SettingsSecurityPage() {
  useDocumentTitle(SETTINGS_COPY.rows.security);
  const back = useBackToHub();
  const navigate = useNavigate();
  const pinOn = usePinEnabled();
  const [mode, setMode] = useState<PinFlowMode>('create');
  const [open, setOpen] = useState(false);
  // Each opening gets a new key, so the dialog never remembers the last one.
  const [opening, setOpening] = useState(0);

  const start = (next: PinFlowMode): void => {
    setMode(next);
    setOpening((count) => count + 1);
    setOpen(true);
  };

  return (
    <ScreenContainer
      placement="top"
      bar={<PageHeader title={SETTINGS_COPY.rows.security} onBack={back} />}
    >
      <div className="set__stack">
        <div>
          <Checkbox
            label={COPY.lock.label}
            hint={COPY.lock.hint}
            checked={pinOn === true}
            disabled={pinOn === undefined}
            onChange={() => {
              start(pinOn ? 'off' : 'create');
            }}
          />
        </div>
        {pinOn ? (
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                start('change');
              }}
            >
              {COPY.change}
            </Button>
          </div>
        ) : null}
        {FEATURES.passwordChange ? (
          <SettingsSection heading={COPY.passwordHeading}>
            <div className="set__gap">
              <Button
                variant="secondary"
                onClick={() => {
                  void navigate(ROUTES.settingsPassword());
                }}
              >
                {COPY.password}
              </Button>
            </div>
          </SettingsSection>
        ) : null}
      </div>
      <PinFlowModal
        key={opening}
        open={open}
        mode={mode}
        onClose={() => {
          setOpen(false);
        }}
      />
    </ScreenContainer>
  );
}

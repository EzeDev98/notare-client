import { useNavigate } from 'react-router';

import { useTheme } from '@/app/providers/theme-context';
import { ROUTES } from '@/app/routes';
import { useSessionUser } from '@/app/shell/useSessionUser';
import { Card, PageHeader, ScreenContainer } from '@/design-system/ui';
import { useSessions } from '@/features/auth/hooks/useSessions';
import type { CurrentUser } from '@/features/auth/types';
import { usePinEnabled } from '@/features/security/usePinEnabled';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './Settings.css';
import { SETTINGS_COPY as COPY } from './settingsContent';
import { SettingsRow } from './SettingsRow';
import { useSyncSummary } from './useSyncSummary';

function SettingsHub({ user }: { user: CurrentUser }) {
  useDocumentTitle(COPY.title);
  const navigate = useNavigate();
  const { preference } = useTheme();
  const { word: syncValue, counts } = useSyncSummary(user.id);
  const { sessions } = useSessions();
  const pinOn = usePinEnabled();

  const go = (to: string) => () => {
    void navigate(to);
  };

  return (
    <ScreenContainer
      placement="top"
      bar={
        <PageHeader
          title={COPY.title}
          onBack={() => {
            void navigate(ROUTES.notes());
          }}
        />
      }
    >
      <Card className="set__card">
        <ul className="set__list">
          <SettingsRow label={COPY.rows.account} value={user.username} onSelect={go(ROUTES.settingsAccount())} />
          <SettingsRow
            label={COPY.rows.appearance}
            value={COPY.theme[preference]}
            onSelect={go(ROUTES.settingsAppearance())}
          />
          <SettingsRow label={COPY.rows.sync} value={syncValue} onSelect={go(ROUTES.settingsSync())} />
          <SettingsRow
            label={COPY.rows.devices}
            value={sessions ? String(sessions.length) : undefined}
            onSelect={go(ROUTES.settingsDevices())}
          />
          <SettingsRow
            label={COPY.rows.security}
            value={pinOn === undefined ? undefined : pinOn ? COPY.pin.on : COPY.pin.off}
            onSelect={go(ROUTES.settingsSecurity())}
          />
          <SettingsRow
            label={COPY.rows.deleted}
            value={counts.deleted > 0 ? String(counts.deleted) : undefined}
            onSelect={go(ROUTES.settingsDeleted())}
          />
          <SettingsRow label={COPY.rows.about} onSelect={go(ROUTES.settingsAbout())} />
        </ul>
      </Card>
    </ScreenContainer>
  );
}

/** The Settings hub (master 6.6): a hub of rows, each opening an inner screen. */
export function SettingsHubPage() {
  const user = useSessionUser();
  return user ? <SettingsHub user={user} /> : null;
}

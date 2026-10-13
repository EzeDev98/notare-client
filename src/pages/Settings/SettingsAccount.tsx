import { useAuth } from '@/app/providers/auth-context';
import { useSessionUser } from '@/app/shell/useSessionUser';
import { Button, Card, DetailRow, PageHeader, ScreenContainer } from '@/design-system/ui';
import { displayName } from '@/features/auth/displayName';
import type { CurrentUser } from '@/features/auth/types';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { useBackToHub } from './useBackToHub';

const COPY = SETTINGS_COPY.account;

function Account({ user }: { user: CurrentUser }) {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const { logout } = useAuth();

  return (
    <ScreenContainer placement="top" bar={<PageHeader title={COPY.title} onBack={back} />}>
      <div className="set__stack">
        <Card>
          <DetailRow label={COPY.name}>{displayName(user)}</DetailRow>
          <DetailRow label={COPY.username}>{user.username}</DetailRow>
          <DetailRow label={COPY.email}>{user.email}</DetailRow>
        </Card>
        <p className="set__note">{COPY.note}</p>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              void logout();
            }}
          >
            {COPY.signOut}
          </Button>
        </div>
      </div>
    </ScreenContainer>
  );
}

/** Settings > Account (master 6.6): who you are, read-only, and Sign out. */
export function SettingsAccountPage() {
  const user = useSessionUser();
  return user ? <Account user={user} /> : null;
}

import { useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { useTheme } from '@/app/providers/theme-context';
import { ROUTES } from '@/app/routes';
import { DrawerContent, Overlay, type Tint } from '@/design-system/ui';
import type { CurrentUser } from '@/features/auth/types';

import { DRAWER_VIEWS, SHELL_COPY } from './shellContent';
import { useDrawerCounts } from './useDrawerCounts';
import { useDrawerSync } from './useDrawerSync';
import { useNotesView } from './useNotesView';
import { useSessionUser } from './useSessionUser';

interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** One of six avatar colours, the same for the same person every time. */
const tintFor = (userId: number): Tint => ((Math.abs(userId) % 6) + 1) as Tint;

function SignedInDrawer({ user, open, onClose }: AppDrawerProps & { user: CurrentUser }) {
  const { logout } = useAuth();
  const { resolved } = useTheme();
  const navigate = useNavigate();
  const current = useNotesView();
  const counts = useDrawerCounts(user.id);
  const sync = useDrawerSync(counts.waiting);

  const go = (to: string) => () => {
    onClose();
    void navigate(to);
  };

  const items = [
    ...DRAWER_VIEWS.map(({ view, label }) => ({
      label,
      count: counts[view],
      current: current === view,
      onSelect: go(ROUTES.notes(view)),
    })),
    { label: SHELL_COPY.settings, current: current === 'settings', onSelect: go(ROUTES.settings()) },
  ];

  return (
    <Overlay open={open} onClose={onClose} variant="drawer" title={SHELL_COPY.drawerName}>
      <DrawerContent
        logoScheme={resolved}
        name={`${user.firstName} ${user.lastName}`.trim() || user.username}
        email={user.email}
        tint={tintFor(user.id)}
        items={items}
        sync={sync}
        onSignOut={() => {
          onClose();
          void logout();
        }}
      />
    </Overlay>
  );
}

/** The 280px drawer (master 5.3), wired to the signed-in person and the local database. */
export function AppDrawer({ open, onClose }: AppDrawerProps) {
  const user = useSessionUser();
  return user ? <SignedInDrawer user={user} open={open} onClose={onClose} /> : null;
}

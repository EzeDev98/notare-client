import { Contrast, Info, LogOut, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { ROUTES } from '@/app/routes';
import { DrawerContent, Overlay, type Tint } from '@/design-system/ui';
import { displayName } from '@/features/auth/displayName';
import type { CurrentUser } from '@/features/auth/types';

import { SHELL_COPY } from './shellContent';
import { useSessionUser } from './useSessionUser';

interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** One of six avatar colours, the same for the same person every time. */
const tintFor = (userId: number): Tint => ((Math.abs(userId) % 6) + 1) as Tint;

function SignedInDrawer({ user, open, onClose }: AppDrawerProps & { user: CurrentUser }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const go = (to: string) => () => {
    onClose();
    void navigate(to);
  };

  const items = [
    { label: SHELL_COPY.appearance, icon: Contrast, onSelect: go(ROUTES.settingsAppearance()) },
    { label: SHELL_COPY.sync, icon: RefreshCw, onSelect: go(ROUTES.settingsSync()) },
    { label: SHELL_COPY.settings, icon: Settings, onSelect: go(ROUTES.settingsGeneral()) },
    { label: SHELL_COPY.about, icon: Info, onSelect: go(ROUTES.settingsAbout()) },
  ];

  return (
    <Overlay open={open} onClose={onClose} variant="drawer" title={SHELL_COPY.drawerName}>
      <DrawerContent
        name={displayName(user)}
        email={user.email}
        tint={tintFor(user.id)}
        items={items}
        signOut={{
          label: SHELL_COPY.signOut,
          icon: LogOut,
          onSelect: () => {
            onClose();
            void logout();
          },
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

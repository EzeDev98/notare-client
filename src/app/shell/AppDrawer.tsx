/** The left drawer: the person, note counts and links to the other screens. */
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

export function AppDrawer({ open, onClose }: AppDrawerProps) {
  const user = useSessionUser();
  return user ? <SignedInDrawer user={user} open={open} onClose={onClose} /> : null;
}

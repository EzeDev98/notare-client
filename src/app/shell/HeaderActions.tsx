import { Bell, Pen } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';
import { useUnreadCount } from '@/features/notifications/hooks/useUnreadCount';

import { NotificationsModal } from './NotificationsModal';
import { SHELL_COPY } from './shellContent';
import { useSessionUser } from './useSessionUser';
import { useStartNote } from './useStartNote';

/** The bell (with the unread count) and the pen (new note), at the right of the header bar. */
export function HeaderActions() {
  const user = useSessionUser();
  const unread = useUnreadCount();
  const startNote = useStartNote();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <IconButton
        className="shell__bell"
        icon={Bell}
        label={SHELL_COPY.notifications}
        badge={unread > 0 ? unread : undefined}
        onClick={() => {
          setOpen(true);
        }}
      />
      <IconButton
        className="shell__pen"
        icon={Pen}
        label={SHELL_COPY.newNote}
        onClick={startNote}
      />
      <NotificationsModal
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

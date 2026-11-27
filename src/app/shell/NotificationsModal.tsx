/** The notifications modal opened from the bell. */
import { Bell } from 'lucide-react';
import { useMemo } from 'react';

import {
  Button,
  EmptyState,
  InfoBanner,
  NotificationRow,
  Overlay,
  Spinner,
} from '@/design-system/ui';
import { composeNotification } from '@/features/notifications/composeNotification';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { NOTIFICATION_COPY as C } from '@/features/notifications/notificationContent';

import { useNotificationActions } from './useNotificationActions';

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsModal({ open, onClose }: NotificationsModalProps) {
  const query = useNotifications(false, 0, open);
  const rows = useMemo(() => query.data?.content ?? [], [query.data]);
  const act = useNotificationActions(onClose);

  const anyUnread = rows.some((n) => n.readAt === null);

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={C.title}
      footer={
        <Button
          variant="ghost"
          disabled={!anyUnread}
          busy={act.markingAll}
          onClick={act.markAll}
        >
          {C.markAll}
        </Button>
      }
    >
      {query.isPending ? (
        <Spinner />
      ) : query.isError && rows.length === 0 ? (
        <InfoBanner>
          {C.loadFailed}{' '}
          <Button
            variant="ghost"
            onClick={() => {
              void query.refetch();
            }}
          >
            {C.retryLoad}
          </Button>
        </InfoBanner>
      ) : rows.length === 0 ? (
        <EmptyState icon={Bell} title={C.empty.title} description={C.empty.description} />
      ) : (
        <div role="list">
          {rows.map((n) => {
            const composed = composeNotification(n);
            const busy = act.busyId === n.id;
            return (
              <div role="listitem" key={n.id}>
                <NotificationRow
                  text={composed.text}
                  meta={composed.meta}
                  unread={n.readAt === null}
                  onDismiss={() => {
                    act.dismiss(n);
                  }}
                  actions={
                    composed.action === 'open' ? (
                      <Button
                        variant="secondary"
                        busy={busy}
                        onClick={() => {
                          void act.open(n);
                        }}
                      >
                        {C.buttons.open}
                      </Button>
                    ) : composed.action === 'retry' ? (
                      <Button
                        variant="secondary"
                        busy={busy}
                        onClick={() => {
                          void act.retry(n);
                        }}
                      >
                        {C.buttons.retry}
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

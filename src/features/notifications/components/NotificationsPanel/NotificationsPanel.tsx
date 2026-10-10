import { useState, type AnimationEventHandler } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BellIcon, EnvelopeIcon } from '@patternfly/react-icons';

import { collaborationService } from '@/features/collaboration/api/collaborationService';
import { composeNotificationMessage } from '@/features/notifications/compose';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/features/notifications/hooks/useNotificationMutations';
import type { NotificationResponse } from '@/features/notifications/types';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import './NotificationsPanel.css';
import { ROUTES } from '@/app/routes';

interface NotificationsPanelProps {
  onClose: () => void;
  isClosing?: boolean;
  onAnimationEnd?: AnimationEventHandler<HTMLDivElement>;
}

/**
 * The bell icon's quick-glance panel — Step 1 of the notifications rework
 * (the bell used to be a bare `<Link to="/notifications">`; clicking it a
 * second time had nothing to toggle, which is the bug this component
 * fixes).
 *
 * A THIN layer over the same hooks/mutations `Notifications.tsx` (the full
 * `/notifications` page remains available by direct route) already uses —
 * one source of truth for what a notification IS and how it mutates, two
 * places that render it, rather than a second copy of that logic drifting
 * out of sync with the first.
 *
 * The panel's footer intentionally expands this same surface in place
 * instead of navigating away. The bell remains the single toggle for
 * opening and closing the panel, while the expanded state simply gives
 * the user more room to review the existing notification list.
 *
 * Always page 0, unreadOnly=false — a glance-and-act surface, not a
 * replacement for the full page's own filter/pager. `PAGE_SIZE` is still
 * 20 (`useNotifications.ts`) as of this component, so the list below
 * scrolls internally past a fixed max-height rather than growing the panel
 * past the viewport; capping it at 5 with no scrolling at all is a later,
 * separate step.
 */
export function NotificationsPanel({
  onClose,
  isClosing = false,
  onAnimationEnd,
}: NotificationsPanelProps) {
  const notifications = useNotifications(false, 0);

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const [confirmingDelete, setConfirmingDelete] = useState<NotificationResponse | null>(null);
  const [confirmingReject, setConfirmingReject] = useState<NotificationResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const rows = notifications.data?.content ?? [];

  const acceptCollaboration = useMutation({
    mutationFn: (collaborationId: number) =>
      collaborationService.acceptCollaboration(collaborationId),
    onSuccess: async (_, collaborationId) => {
      const notification = rows.find(
        (item) => item.type === 'COLLABORATION_INVITED' && item.targetId === collaborationId,
      );

      if (notification && notification.readAt === null) {
        markRead.mutate(notification.id);
      }

      await notifications.refetch();
    },
  });

  const rejectCollaboration = useMutation({
    mutationFn: (collaborationId: number) =>
      collaborationService.rejectCollaboration(collaborationId),
    onSuccess: async (_, collaborationId) => {
      const notification = rows.find(
        (item) => item.type === 'COLLABORATION_INVITED' && item.targetId === collaborationId,
      );

      if (notification && notification.readAt === null) {
        markRead.mutate(notification.id);
      }

      await notifications.refetch();
    },
  });

  const actorIds = rows.map((notification) => notification.actorId).filter(
    (id): id is number => id !== null,
  );
  const { profiles, isLoading: namesLoading } = useUserLookup(actorIds);

  function resolveActor(actorId: number): string | undefined {
    if (namesLoading) return undefined;
    const profile = profiles.get(actorId);
    return profile ? formatUserName(profile) : undefined;
  }

  function handleMarkRead(notification: NotificationResponse) {
    if (notification.readAt !== null) return;
    markRead.mutate(notification.id);
  }

  function handleDelete(notification: NotificationResponse) {
    setConfirmingDelete(notification);
  }

  function confirmDelete() {
    if (confirmingDelete === null) return;

    const notification = confirmingDelete;
    setConfirmingDelete(null);
    deleteNotification.mutate(notification.id);
  }

  function handleAcceptInvitation(notification: NotificationResponse) {
    if (notification.type !== 'COLLABORATION_INVITED') return;
    if (notification.targetId === null) return;

    acceptCollaboration.mutate(notification.targetId);
  }

  function handleRejectInvitation(notification: NotificationResponse) {
    if (notification.type !== 'COLLABORATION_INVITED') return;
    if (notification.targetId === null) return;

    setConfirmingReject(notification);
  }

  function confirmRejectInvitation() {
    if (confirmingReject === null) return;
    if (confirmingReject.targetId === null) return;

    const notification = confirmingReject;
    setConfirmingReject(null);
    rejectCollaboration.mutate(notification.targetId);
  }

  return (
    <div
      className={`notifications-panel${isExpanded ? ' notifications-panel--expanded' : ''}`}
      data-closing={isClosing || undefined}
      role="dialog"
      aria-label="Notifications"
      onAnimationEnd={onAnimationEnd}
    >
      <header className="notifications-panel__header">
        <h2>Notifications</h2>
        <Button
          variant="ghost"
          size="sm"
          loading={markAllRead.isPending}
          disabled={markAllRead.isPending || rows.every((row) => row.readAt !== null)}
          onClick={() => {
            markAllRead.mutate();
          }}
        >
          Mark all read
        </Button>
      </header>

      <div className="notifications-panel__body">
        {notifications.isLoading ? (
          <div className="notifications-panel__centre">
            <Spinner label="Loading notifications" />
          </div>
        ) : null}

        {notifications.isError ? (
          <div className="notifications-panel__centre" role="alert">
            <p>Couldn&apos;t load your notifications.</p>
            <button
              type="button"
              className="notifications-panel__retry"
              onClick={() => void notifications.refetch()}
            >
              Try again
            </button>
          </div>
        ) : null}

        {notifications.data && rows.length === 0 ? (
          <div className="notifications-panel__centre">
            <p className="notifications-panel__empty">No notifications yet.</p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <ul className="notifications-panel__list" role="list">
            {rows.map((notification) => {
              const isUnread = notification.readAt === null;
              return (
                <li
                  key={notification.id}
                  className="notifications-panel__row"
                  data-unread={isUnread || undefined}
                >
                  <span className="notifications-panel__dot" aria-hidden={!isUnread}>
                    {isUnread ? <span className="pf-v6-screen-reader">Unread</span> : null}
                  </span>

                  <div className="notifications-panel__row-main">
                    {notification.type === 'COLLABORATION_INVITED' ? (
                      <Link
                        to={ROUTES.legacy.collaborations()}
                        className="notifications-panel__message notifications-panel__message-link"
                        onClick={onClose}
                      >
                        {composeNotificationMessage(notification, resolveActor)}
                      </Link>
                    ) : (
                      <p className="notifications-panel__message">
                        {composeNotificationMessage(notification, resolveActor)}
                      </p>
                    )}
                    <time
                      className="notifications-panel__time"
                      dateTime={notification.createdAt}
                      title={formatServerDateTimeAbsolute(notification.createdAt)}
                    >
                      {formatServerDateTimeRelative(notification.createdAt)}
                    </time>
                  </div>

                  <div className="notifications-panel__row-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="notifications-panel__row-action"
                      loading={isUnread && markRead.isPending && markRead.variables === notification.id}
                      disabled={isUnread && markRead.isPending && markRead.variables === notification.id}
                      onClick={() => {
                        if (!isUnread) return;
                        handleMarkRead(notification);
                      }}
                    >
                      Mark read
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="notifications-panel__row-action notifications-panel__row-action--delete"
                      loading={
                        deleteNotification.isPending &&
                        deleteNotification.variables === notification.id
                      }
                      disabled={
                        deleteNotification.isPending &&
                        deleteNotification.variables === notification.id
                      }
                      onClick={() => {
                        handleDelete(notification);
                      }}
                    >
                      Delete
                    </Button>

                    {notification.type === 'COLLABORATION_INVITED' &&
                    notification.targetId !== null ? (
                      <div className="notifications-panel__collaboration-actions">
                        <button
                          type="button"
                          className="notifications-panel__collaboration-button notifications-panel__collaboration-button--accept"
                          disabled={
                            (acceptCollaboration.isPending &&
                              acceptCollaboration.variables === notification.targetId) ||
                            (rejectCollaboration.isPending &&
                              rejectCollaboration.variables === notification.targetId)
                          }
                          onClick={() => {
                            handleAcceptInvitation(notification);
                          }}
                        >
                          {acceptCollaboration.isPending &&
                          acceptCollaboration.variables === notification.targetId
                            ? 'Accepting…'
                            : 'Accept'}
                        </button>

                        <button
                          type="button"
                          className="notifications-panel__collaboration-button notifications-panel__collaboration-button--reject"
                          disabled={
                            (acceptCollaboration.isPending &&
                              acceptCollaboration.variables === notification.targetId) ||
                            (rejectCollaboration.isPending &&
                              rejectCollaboration.variables === notification.targetId)
                          }
                          onClick={() => {
                            handleRejectInvitation(notification);
                          }}
                        >
                          {rejectCollaboration.isPending &&
                          rejectCollaboration.variables === notification.targetId
                            ? 'Rejecting…'
                            : 'Reject'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {confirmingDelete !== null ? (
        <Modal
          icon={<BellIcon aria-hidden="true" />}
          description="Delete this notification? This can't be undone."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setConfirmingDelete(null);
            },
          }}
          primaryAction={{
            label: 'Delete',
            onClick: confirmDelete,
          }}
          onClose={() => {
            setConfirmingDelete(null);
          }}
        />
      ) : null}

      {confirmingReject !== null ? (
        <Modal
          icon={<EnvelopeIcon aria-hidden="true" />}
          description={
            confirmingReject.targetLabel.trim() !== '' ? (
              <>
                Reject this invite? You won't get access to{' '}
                <strong>{confirmingReject.targetLabel}</strong>.
              </>
            ) : (
              <>Reject this invite? You won't get access to this invitation.</>
            )
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setConfirmingReject(null);
            },
          }}
          primaryAction={{
            label: 'Reject',
            onClick: confirmRejectInvitation,
          }}
          onClose={() => {
            setConfirmingReject(null);
          }}
        />
      ) : null}

      {!isExpanded ? (
        <footer className="notifications-panel__footer">
          <button
            type="button"
            className="notifications-panel__view-all"
            onClick={() => {
              setIsExpanded(true);
            }}
          >
            View all notifications
          </button>
        </footer>
      ) : null}
    </div>
  );
}

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';

import { collaborationService } from '@/features/collaboration/api/collaborationService';
import { composeNotificationMessage } from '@/features/notifications/compose';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/features/notifications/hooks/useNotificationMutations';
import { useUnreadCount } from '@/features/notifications/hooks/useUnreadCount';
import type { NotificationResponse } from '@/features/notifications/types';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Notifications.css';

export function NotificationsPage() {
  useDocumentTitle('Notifications');

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);

  const notifications = useNotifications(unreadOnly, page);
  const unreadCount = useUnreadCount();

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const acceptCollaboration = useMutation({
    mutationFn: (collaborationId: number) =>
      collaborationService.acceptCollaboration(collaborationId),
    onSuccess: async (_, collaborationId) => {
      const notification = rows.find(
        (item) =>
          item.type === 'COLLABORATION_INVITED' &&
          item.targetId === collaborationId,
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
        (item) =>
          item.type === 'COLLABORATION_INVITED' &&
          item.targetId === collaborationId,
      );

      if (notification && notification.readAt === null) {
        markRead.mutate(notification.id);
      }

      await notifications.refetch();
    },
  });

  const actorIds = (notifications.data?.content ?? [])
    .map((notification) => notification.actorId)
    .filter((id): id is number => id !== null);
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

    rejectCollaboration.mutate(notification.targetId);
  }

  const rows = notifications.data?.content ?? [];

  return (
    <section className="notifications-page">
      <header className="notifications-page__header">
        <h1>Notifications</h1>
        <Button
          variant="ghost"
          size="sm"
          loading={markAllRead.isPending}
          disabled={markAllRead.isPending || unreadCount === 0}
          onClick={() => {
            markAllRead.mutate();
          }}
        >
          Mark all read
        </Button>
      </header>

      <label className="notifications-page__filter">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(event) => {
            setUnreadOnly(event.target.checked);
            setPage(0);
          }}
        />
        Show unread only
      </label>

      {notifications.isLoading ? (
        <div className="notifications-page__centre">
          <Spinner label="Loading notifications" />
        </div>
      ) : null}

      {notifications.isError ? (
        <div className="notifications-page__centre" role="alert">
          <p>Couldn&apos;t load your notifications.</p>
          <button
            type="button"
            className="notifications-page__retry"
            onClick={() => void notifications.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {notifications.data && rows.length === 0 ? (
        <div className="notifications-page__centre">
          <h2 className="notifications-page__empty-title">
            {unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          </h2>
          <p className="notifications-page__empty-body">
            {unreadOnly
              ? 'You are all caught up.'
              : "When something happens — a share, an invitation, a finished transcription — it will show up here."}
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <ul className="notifications-page__list" role="list">
            {rows.map((notification) => {
              const isUnread = notification.readAt === null;
              return (
                <li
                  key={notification.id}
                  className="notifications-page__row"
                  data-unread={isUnread || undefined}
                >
                  <span className="notifications-page__dot" aria-hidden={!isUnread}>
                    {isUnread ? <span className="ds-visually-hidden">Unread</span> : null}
                  </span>

                  <div className="notifications-page__row-main">
                    {notification.type === 'COLLABORATION_INVITED' ? (
                      <Link
                        to="/collaborations"
                        className="notifications-page__message notifications-page__message-link"
                      >
                        {composeNotificationMessage(notification, resolveActor)}
                      </Link>
                    ) : (
                      <p className="notifications-page__message">
                        {composeNotificationMessage(notification, resolveActor)}
                      </p>
                    )}
                    <time
                      className="notifications-page__time"
                      dateTime={notification.createdAt}
                      title={formatServerDateTimeAbsolute(notification.createdAt)}
                    >
                      {formatServerDateTimeRelative(notification.createdAt)}
                    </time>
                  </div>

                  <div className="notifications-page__row-actions">
                    {isUnread ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={markRead.isPending && markRead.variables === notification.id}
                        disabled={markRead.isPending && markRead.variables === notification.id}
                        onClick={() => {
                          handleMarkRead(notification);
                        }}
                      >
                        Mark read
                      </Button>
                    ) : null}

                    <Button
                      variant="ghost"
                      size="sm"
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
                      <div className="notifications-page__collaboration-actions">
                        <button
                          type="button"
                          className="notifications-page__collaboration-button notifications-page__collaboration-button--accept"
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
                          className="notifications-page__collaboration-button notifications-page__collaboration-button--reject"
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

          <div className="notifications-page__pager">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0 || notifications.isFetching}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!notifications.data?.hasNext || notifications.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

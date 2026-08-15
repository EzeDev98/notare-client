import { useState } from 'react';

import { useReceivedCollaborations, useSentCollaborations } from '@/features/collaboration/hooks/useCollaborations';
import { composeNotificationMessage } from '@/features/notifications/compose';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/features/notifications/hooks/useNotificationMutations';
import { useUnreadCount } from '@/features/notifications/hooks/useUnreadCount';
import type { NotificationResponse } from '@/features/notifications/types';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Notifications.css';

/**
 * `/notifications` (architecture doc §4.2: "list, unread filter, mark
 * read, mark all, delete"). Poll-driven, not push — the unread badge in
 * the shell (`useUnreadCount`) is the only thing that polls; this page
 * fetches once on open, same "fetch the list on open" split §2.5 spells
 * out.
 */
export function NotificationsPage() {
  useDocumentTitle('Notifications');

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);

  const notifications = useNotifications(unreadOnly, page);
  const unreadCount = useUnreadCount();

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  // Best-effort actor names, same technique `ShareNote.tsx`'s `resolveName`
  // already uses for `sharedWithUserId`: there is no `/user/lookup` (G2),
  // so the only names this app can attach to a bare id are the ones
  // already sitting in the accepted-collaborations cache. An actor could
  // be someone who invited ME (received) or someone I invited (sent) —
  // both are checked.
  const sent = useSentCollaborations();
  const received = useReceivedCollaborations();

  function resolveActor(actorId: number): string | undefined {
    const fromSent = (sent.data?.content ?? []).find(
      (row) => row.status === 'ACCEPTED' && row.collaborator.id === actorId,
    );
    if (fromSent) {
      const full = `${fromSent.collaborator.firstName} ${fromSent.collaborator.lastName}`.trim();
      return full === '' ? fromSent.collaborator.username : full;
    }

    const fromReceived = (received.data?.content ?? []).find(
      (row) => row.status === 'ACCEPTED' && row.owner.id === actorId,
    );
    if (fromReceived) {
      const full = `${fromReceived.owner.firstName} ${fromReceived.owner.lastName}`.trim();
      return full === '' ? fromReceived.owner.username : full;
    }

    return undefined;
  }

  function handleMarkRead(notification: NotificationResponse) {
    if (notification.readAt !== null) return;
    markRead.mutate(notification.id);
  }

  function handleDelete(notification: NotificationResponse) {
    deleteNotification.mutate(notification.id);
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
                  {/* Not decorative — the ONLY visual difference between
                      read and unread besides colour (§36: never colour alone). */}
                  <span className="notifications-page__dot" aria-hidden={!isUnread}>
                    {isUnread ? <span className="ds-visually-hidden">Unread</span> : null}
                  </span>

                  <div className="notifications-page__row-main">
                    <p className="notifications-page__message">
                      {composeNotificationMessage(notification, resolveActor)}
                    </p>
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

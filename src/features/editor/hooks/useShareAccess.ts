import { useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { STATUS_COPY } from '@/app/status/statusContent';
import { useToast } from '@/design-system/ui';
import { sessionUserOf } from '@/features/auth/sessionUser';
import { copyNote } from '@/features/notes/actions/noteActions';
import type { NoteRole, NoteRow } from '@/features/notes/local/noteRow';
import { sharedRepository } from '@/features/notes/local/sharedRepository';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useUnreadCount } from '@/features/notifications/hooks/useUnreadCount';
import { refreshShared } from '@/features/sharedNotes/refreshShared';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

/** What happened to this person's access to the open note (master 6.7, step 14d). */
export interface AccessChange {
  kind: 'stopped' | 'viewer' | 'editor';
  /** What the note is for this person from now on. Stopped and viewer both read only. */
  role: NoteRole;
  /** Who changed it. */
  owner: string;
}

/**
 * Watches for the owner taking back or changing this person's access while the note is open.
 *
 * The trigger is an unread notification about this note (the existing unread poll finds it).
 * The answer comes from "Shared with me", refreshed at that moment, so a banner is shown only
 * for what the server now says. A change that has been seen stays until the note is closed,
 * even after the notification is read. Notes you own are never watched.
 */
export function useShareAccess(row: NoteRow): AccessChange | null {
  const serverId = row.serverId;
  const watching = serverId !== null && row.role !== 'owner';

  const unread = useUnreadCount();
  const unreadList = useNotifications(true, 0, watching && unread > 0);
  const { refetch } = unreadList;
  useEffect(() => {
    if (watching && unread > 0) void refetch();
  }, [watching, unread, refetch]);

  const trigger = unreadList.data?.content.find(
    (item) =>
      item.targetId === serverId &&
      (item.type === 'NOTE_SHARE_REVOKED' || item.type === 'NOTE_SHARE_PERMISSION_CHANGED'),
  );

  // Refresh "Shared with me" once for each trigger, then trust it.
  const triggerId = trigger?.id ?? null;
  const [settledFor, setSettledFor] = useState<number | null>(null);
  useEffect(() => {
    if (triggerId === null) return undefined;
    let cancelled = false;
    void refreshShared()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setSettledFor(triggerId);
      });
    return () => {
      cancelled = true;
    };
  }, [triggerId]);

  // null while loading, false when this note is no longer shared with the person.
  const current = useStableLiveQuery(
    async () => (serverId === null ? false : ((await sharedRepository.get(serverId)) ?? false)),
    [serverId],
    null,
  );

  let found: AccessChange | null = null;
  if (trigger !== undefined && settledFor === trigger.id && current !== null) {
    const owner =
      (current !== false ? current.ownerName : null) ?? row.ownerName ?? STATUS_COPY.theOwner;
    if (current === false) {
      found = { kind: 'stopped', role: 'viewer', owner };
    } else if (trigger.type === 'NOTE_SHARE_PERMISSION_CHANGED' && current.role !== row.role) {
      found = { kind: current.role, role: current.role, owner };
    }
  }

  // Once seen, it stays for this note, even after the notification is marked read.
  const [kept, setKept] = useState<{ noteId: number; change: AccessChange } | null>(null);
  const foundKind = found?.kind;
  const foundOwner = found?.owner;
  useEffect(() => {
    if (serverId === null || foundKind === undefined || foundOwner === undefined) return;
    setKept({
      noteId: serverId,
      change: { kind: foundKind, role: foundKind === 'editor' ? 'editor' : 'viewer', owner: foundOwner },
    });
  }, [serverId, foundKind, foundOwner]);

  return kept !== null && kept.noteId === serverId ? kept.change : null;
}

/** "Keep a copy" on the Sharing stopped banner: a new note of your own, then the toast. */
export function useKeepCopy(row: NoteRow): () => void {
  const { toast } = useToast();
  const { state } = useAuth();
  const userId = sessionUserOf(state)?.id ?? null;

  return () => {
    if (userId === null) return;
    void copyNote(userId, row.localId).then((saved) => {
      if (saved) toast(STATUS_COPY.sharingStopped.copied);
    });
  };
}

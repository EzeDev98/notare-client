import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { STATUS_COPY } from '@/app/status/statusContent';
import { useToast } from '@/design-system/ui';
import type { CollabState } from '@/features/collab/CollabProvider';
import type { CollabRole } from '@/features/collab/collabProtocol';
import type { AccessChange } from '@/features/editor/hooks/useShareAccess';
import { dropSharedNote } from '@/features/notes/actions/noteActions';
import type { NoteRow } from '@/features/notes/local/noteRow';

/** What the live channel says happened to this person's access to the open note. */
export interface LiveAccess {
  /** Viewer or editor: the role changed while the note was open. */
  change: AccessChange | null;
  /** The owner took access away. The name of the owner, or null. */
  removedBy: string | null;
}

const NONE: LiveAccess = { change: null, removedBy: null };

/**
 * The same states as step 14d, but the moment they happen (step 16h): a ROLE frame says the role
 * changed, and a closed channel (close code 4403, or a refused ticket) says access is gone. Only for
 * notes you do not own. The role the note opened with is the baseline, so a role that was already
 * different when the note opened is not announced as a change.
 */
export function useLiveAccess(row: NoteRow, live: CollabState | undefined): LiveAccess {
  const serverId = row.serverId;
  const watching = serverId !== null && row.role !== 'owner' && live !== undefined;
  const role = live?.role ?? null;
  const [opened, setOpened] = useState<{ noteId: number; role: CollabRole } | null>(null);

  useEffect(() => {
    if (!watching || serverId === null || role === null) return;
    setOpened((current) => (current?.noteId === serverId ? current : { noteId: serverId, role }));
  }, [watching, serverId, role]);

  if (!watching || live === undefined) return NONE;
  const owner = row.ownerName ?? STATUS_COPY.theOwner;
  if (live.status === 'revoked') return { change: null, removedBy: owner };
  if (role !== null && role !== 'owner' && opened?.noteId === serverId && role !== opened.role) {
    return { change: { kind: role, role, owner }, removedBy: null };
  }
  return NONE;
}

/** Sharing stopped (from the notification) outranks everything. Otherwise the live change is the newer news. */
export function pickAccess(polled: AccessChange | null, live: AccessChange | null): AccessChange | null {
  if (polled?.kind === 'stopped') return polled;
  return live ?? polled;
}

/**
 * Holds a change back until the person's last edit is written to this device, so nothing typed just
 * before a demotion is lost. The note turns read-only only after that (step 16h).
 */
export function useAfterFlush(change: AccessChange | null, flush: () => Promise<void>): AccessChange | null {
  const [applied, setApplied] = useState<AccessChange | null>(null);
  const kind = change?.kind;
  const role = change?.role;
  const owner = change?.owner;

  useEffect(() => {
    if (kind === undefined || role === undefined || owner === undefined) {
      setApplied(null);
      return undefined;
    }
    let cancelled = false;
    void flush()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setApplied({ kind, role, owner });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, role, owner, flush]);

  return applied;
}

/**
 * Removed while the note is open: save the last edit, leave the note, say who removed you, and take
 * the note off this device so it is no longer in the list. Happens once.
 */
export function useLeaveWhenRemoved(row: NoteRow, removedBy: string | null, flush: () => Promise<void>): void {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { localId } = row;
  const handled = useRef(false);

  useEffect(() => {
    if (removedBy === null || handled.current) return;
    handled.current = true;
    void flush()
      .catch(() => undefined)
      .then(() => {
        void navigate(ROUTES.notes());
        toast(STATUS_COPY.accessRemoved(removedBy));
        void dropSharedNote(localId);
      });
  }, [removedBy, flush, localId, navigate, toast]);
}

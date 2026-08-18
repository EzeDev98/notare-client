import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useSentCollaborations } from '@/features/collaboration/hooks/useCollaborations';
import type { CollaborationResponse } from '@/features/collaboration/types';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { useCreateShare, useRevokeShare, useUpdateShare } from '@/features/sharing/hooks/useShareMutations';
import { useShares } from '@/features/sharing/hooks/useShares';
import type { NoteShareResponse, SharePermission } from '@/features/sharing/types';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { isBadRequest } from '@/lib/http/errors';
import { Button } from '@/design-system/components/Button/Button';
import { Select } from '@/design-system/components/Select/Select';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './ShareNote.css';

/**
 * `/notes/:id/share` (architecture doc §4.2: "list grants, change
 * permission, revoke; recipient picker limited to accepted collaborators").
 * The owner-side counterpart to `SharedNotesPage` — this manages the grants
 * a note's OWNER controls; `/shared` is the recipient's separate view of
 * the same underlying rows (`features/sharing/types.ts`'s own doc comment
 * on why the two stay separate all the way up).
 *
 * ONLINE-ONLY, same reasoning as `sharedNoteService`: grants are not part
 * of sync (NOTARE-CLIENT-ARCHITECTURE.md §1.3), so there is no local copy
 * to read while offline and no outbox to queue a share/revoke into.
 */
export function ShareNotePage() {
  const { noteId: noteIdParam } = useParams();
  const noteId = parseNoteId(noteIdParam);

  const noteState = useNote(noteId);
  const title = noteState.status === 'ready' ? noteState.row.title.trim() : '';
  useDocumentTitle(title === '' ? 'Share note' : `Share “${title}”`);

  if (noteId === null) {
    return (
      <section className="share-note">
        <ShareNoteChrome noteId={null} />
        <div className="share-note__centre">
          <h1>Note not found</h1>
          <Link to="/notes">Back to your notes</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="share-note">
      <ShareNoteChrome noteId={noteId} />
      <h1 className="share-note__title">
        Share {title === '' ? <span className="share-note__untitled">Untitled</span> : `“${title}”`}
      </h1>
      <ShareManager noteId={noteId} />
    </section>
  );
}

function ShareNoteChrome({ noteId }: { noteId: number | null }) {
  return (
    <nav className="share-note__back">
      <Link to={noteId === null ? '/notes' : `/notes/${String(noteId)}`}>← Back to note</Link>
    </nav>
  );
}

function ShareManager({ noteId }: { noteId: number }) {
  const grants = useShares(noteId);
  // ACCEPTED only — the picker's whole reason to source from here rather
  // than general user search (architecture doc §2.4: "the share flow is
  // therefore two-stage").
  const sent = useSentCollaborations();

  const create = useCreateShare(noteId);
  const update = useUpdateShare(noteId);
  const revoke = useRevokeShare(noteId);

  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function setRowError(userId: number, message: string) {
    setRowErrors((current) => ({ ...current, [userId]: message }));
  }

  function clearRowError(userId: number) {
    setRowErrors((current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }

  const acceptedCollaborators: CollaborationResponse[] = (sent.data?.content ?? []).filter(
    (row) => row.status === 'ACCEPTED',
  );

  /**
   * A grant's `sharedWithUserId` is bare (types.ts's own doc comment on
   * `NoteShareResponse`) — resolved here via the batch `useUserLookup`
   * feature rather than the accepted-collaborations fetch alone.
   *
   * PREVIOUSLY (before this step) this rendered `User {id}` for every row,
   * matched or not — a real instance of the placeholder-label problem
   * `useUserLookup` exists to fix, now corrected to match
   * `ShareVoiceNotePage`'s already-real-names implementation.
   */
  const { profiles, isLoading: namesLoading } = useUserLookup(
    acceptedCollaborators.map((row) => row.collaboratorId),
  );

  function resolveName(userId: number): string {
    return namesLoading ? `User ${String(userId)}` : formatUserName(profiles.get(userId));
  }

  if (grants.isLoading || sent.isLoading) {
    return (
      <div className="share-note__centre">
        <Spinner label="Loading sharing settings" />
      </div>
    );
  }

  if (grants.isError) {
    return (
      <div className="share-note__centre" role="alert">
        <p>Couldn&apos;t load who this note is shared with.</p>
        <button
          type="button"
          className="share-note__retry"
          onClick={() => void grants.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  const rows = grants.data?.content ?? [];
  const grantedUserIds = new Set(rows.map((row) => row.sharedWithUserId));
  const shareableCollaborators = acceptedCollaborators.filter(
    (row) => !grantedUserIds.has(row.collaboratorId),
  );

  function handleRevoke(row: NoteShareResponse) {
    clearRowError(row.sharedWithUserId);
    revoke.mutate(row.sharedWithUserId, {
      onError: () => {
        setRowError(
          row.sharedWithUserId,
          'Could not revoke access. Check your connection and try again.',
        );
      },
    });
  }

  function handlePermissionChange(row: NoteShareResponse, permission: SharePermission) {
    clearRowError(row.sharedWithUserId);
    update.mutate(
      { userId: row.sharedWithUserId, permission },
      {
        onError: () => {
          setRowError(
            row.sharedWithUserId,
            'Could not change permission. Check your connection and try again.',
          );
        },
      },
    );
  }

  return (
    <>
      <ul className="share-note__list" role="list">
        {rows.length === 0 ? (
          <li className="share-note__empty">Not shared with anyone yet.</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="share-note__row">
              <span className="share-note__name">{resolveName(row.sharedWithUserId)}</span>

              <label className="share-note__permission">
                <span className="share-note__permission-label">Permission</span>
                <select
                  className="ds-control"
                  value={row.permission}
                  disabled={update.isPending && update.variables?.userId === row.sharedWithUserId}
                  onChange={(event) => {
                    handlePermissionChange(row, event.target.value as SharePermission);
                  }}
                >
                  <option value="READ">Read only</option>
                  <option value="WRITE">Can edit</option>
                </select>
              </label>

              <Button
                variant="danger"
                size="sm"
                loading={revoke.isPending && revoke.variables === row.sharedWithUserId}
                disabled={revoke.isPending && revoke.variables === row.sharedWithUserId}
                onClick={() => {
                  handleRevoke(row);
                }}
              >
                Revoke
              </Button>

              {rowErrors[row.sharedWithUserId] ? (
                <p className="share-note__row-error" role="alert">
                  {rowErrors[row.sharedWithUserId]}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <ShareForm
        candidates={shareableCollaborators}
        resolveName={resolveName}
        pending={create.isPending}
        onShare={(sharedWithUserId, permission) => {
          setFormError(null);
          create.mutate(
            { sharedWithUserId, permission },
            {
              onError: (error) => {
                setFormError(
                  isBadRequest(error)
                    ? 'This person already has access — refresh to see the current grant.'
                    : 'Could not share this note. Check your connection and try again.',
                );
              },
            },
          );
        }}
      />

      {formError !== null ? (
        <p className="share-note__form-error" role="alert">
          {formError}
        </p>
      ) : null}
    </>
  );
}

interface ShareFormProps {
  candidates: CollaborationResponse[];
  resolveName: (userId: number) => string;
  pending: boolean;
  onShare: (sharedWithUserId: number, permission: SharePermission) => void;
}

/**
 * The "recipient picker limited to accepted collaborators" the architecture
 * doc names verbatim. A native `<select>` over `candidates`, not
 * `CollaboratorPicker`'s free-text search — that component's whole job is
 * finding someone to INVITE (9C, master-brief lettering); this form can
 * only offer people already through that gate.
 *
 * `resolveName` passed in rather than re-derived here — one batch
 * `useUserLookup` call at `ShareManager` level, not a second one this form
 * would otherwise need for its own option labels.
 */
function ShareForm({ candidates, resolveName, pending, onShare }: ShareFormProps) {
  const [selectedId, setSelectedId] = useState<number | null>(candidates[0]?.collaboratorId ?? null);
  const [permission, setPermission] = useState<SharePermission>('READ');

  if (candidates.length === 0) {
    return (
      <p className="share-note__no-candidates">
        Everyone who has accepted an invitation already has access. Invite someone new from{' '}
        <Link to="/collaborations">Collaborations</Link> first, then come back here to share with
        them.
      </p>
    );
  }

  return (
    <form
      className="share-note__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (selectedId === null) return;
        onShare(selectedId, permission);
      }}
    >
      <Select
        label="Share with"
        value={selectedId ?? ''}
        onChange={(event) => {
          setSelectedId(Number(event.target.value));
        }}
      >
        {candidates.map((row) => (
          <option key={row.collaboratorId} value={row.collaboratorId}>
            {resolveName(row.collaboratorId)}
          </option>
        ))}
      </Select>

      <Select
        label="Permission"
        value={permission}
        onChange={(event) => {
          setPermission(event.target.value as SharePermission);
        }}
      >
        <option value="READ">Read only</option>
        <option value="WRITE">Can edit</option>
      </Select>

      <Button type="submit" variant="primary" loading={pending} disabled={pending}>
        Share
      </Button>
    </form>
  );
}

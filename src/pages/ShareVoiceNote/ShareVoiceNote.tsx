import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { FormSelect } from '@patternfly/react-core';
import { UserMinusIcon } from '@patternfly/react-icons';

import { useSentCollaborations } from '@/features/collaboration/hooks/useCollaborations';
import type { CollaborationResponse } from '@/features/collaboration/types';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { useVoiceNote } from '@/features/voice/hooks/useVoiceNotes';
import {
  useCreateVoiceShare,
  useRevokeVoiceShare,
  useUpdateVoiceShare,
} from '@/features/voiceSharing/hooks/useVoiceShareMutations';
import { useVoiceShares } from '@/features/voiceSharing/hooks/useVoiceShares';
import type { SharePermission, VoiceShareResponse } from '@/features/voiceSharing/types';
import { isBadRequest } from '@/lib/http/errors';
import { parseVoiceNoteId } from '@/pages/VoiceDetail/parseVoiceNoteId';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Select } from '@/design-system/components/Select/Select';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './ShareVoiceNote.css';
import { ROUTES } from '@/app/routes';

/**
 * `/voice/:id/share` — the voice-note counterpart to `ShareNotePage`
 * (architecture doc §4.2's "recipient picker limited to accepted
 * collaborators" applies here identically). Manages the grants a voice
 * note's OWNER controls; `/shared-voice/:id` (13) is the recipient's
 * separate view of the same underlying rows — same all-the-way-up split
 * `ShareNotePage`'s own doc comment describes for notes.
 *
 * STRUCTURALLY MIRRORS `ShareNotePage`/`ShareManager`/`ShareForm` — same
 * component shape, same two-stage rule (only ACCEPTED collaborators are
 * offered, via `useSentCollaborations`, never `CollaboratorPicker`'s
 * free-text invite search), same READ/WRITE `<Select>` picker. NOT a
 * shared component parameterised over note-vs-voice: `ShareNotePage` reads
 * `NoteShareResponse`/`useShares`(note), this reads
 * `VoiceShareResponse`/`useVoiceShares`(voice) — two different wire types
 * behind two different endpoints, the same reasoning that already keeps
 * `SharedNote.tsx` a separate component from `VoiceDetail.tsx` rather than
 * one branching on a type prop.
 *
 * NAMES resolved via the batch `useUserLookup` feature (real "John Doe" /
 * `@username` names), same as `ShareNotePage`'s own `resolveName` — that
 * page originally shipped with a `User {id}` placeholder here first (this
 * page deliberately didn't copy it, at the time the only one of the two
 * using real names); `ShareNotePage` was subsequently brought onto the
 * same `useUserLookup` resolution, so the two now match.
 *
 * ONLINE-ONLY, same reasoning as `ShareNotePage`: grants are not part of
 * sync, so there is no local copy to read offline and no outbox to queue
 * a share/revoke into.
 */
export function ShareVoiceNotePage() {
  const { voiceNoteId: param } = useParams();
  const voiceNoteId = parseVoiceNoteId(param);

  const voiceNote = useVoiceNote(voiceNoteId ?? -1);
  useDocumentTitle('Share voice note');

  if (voiceNoteId === null) {
    return (
      <section className="share-voice-note">
        <ShareVoiceNoteChrome voiceNoteId={null} />
        <div className="share-voice-note__centre">
          <h1>Voice note not found</h1>
          <Link to={ROUTES.legacy.voice()}>Back to voice notes</Link>
        </div>
      </section>
    );
  }

  if (voiceNote.isLoading) {
    return (
      <section className="share-voice-note">
        <ShareVoiceNoteChrome voiceNoteId={voiceNoteId} />
        <div className="share-voice-note__centre">
          <Spinner label="Loading voice note" />
        </div>
      </section>
    );
  }

  if (voiceNote.isError || !voiceNote.data) {
    return (
      <section className="share-voice-note">
        <ShareVoiceNoteChrome voiceNoteId={voiceNoteId} />
        <div className="share-voice-note__centre" role="alert">
          <h1>Can&apos;t open this recording</h1>
          <p className="share-voice-note__muted">
            This recording doesn&apos;t exist, or it isn&apos;t available to you.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="share-voice-note">
      <ShareVoiceNoteChrome voiceNoteId={voiceNoteId} />
      <h1 className="share-voice-note__title">Share voice note</h1>
      <ShareManager voiceNoteId={voiceNoteId} />
    </section>
  );
}

function ShareVoiceNoteChrome({ voiceNoteId }: { voiceNoteId: number | null }) {
  return (
    <nav className="share-voice-note__back">
      <Link
        to={voiceNoteId === null ? ROUTES.legacy.voice() : ROUTES.legacy.voiceDetail(voiceNoteId)}
      >
        ← Back to recording
      </Link>
    </nav>
  );
}

function ShareManager({ voiceNoteId }: { voiceNoteId: number }) {
  const grants = useVoiceShares(voiceNoteId);
  // ACCEPTED only — same gate `ShareNotePage`'s own `ShareManager` uses,
  // not general user search.
  const sent = useSentCollaborations();

  const create = useCreateVoiceShare(voiceNoteId);
  const update = useUpdateVoiceShare(voiceNoteId);
  const revoke = useRevokeVoiceShare(voiceNoteId);

  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState<VoiceShareResponse | null>(null);

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

  // One batch lookup covering every accepted collaborator's id — every row
  // in the grants list AND every option in the ShareForm picker below draw
  // their display name from this same map, so a person's name resolves
  // identically in both places.
  const { profiles, isLoading: namesLoading } = useUserLookup(
    acceptedCollaborators.map((row) => row.collaboratorId),
  );

  function resolveName(userId: number): string {
    return namesLoading ? `User ${String(userId)}` : formatUserName(profiles.get(userId));
  }

  if (grants.isLoading || sent.isLoading) {
    return (
      <div className="share-voice-note__centre">
        <Spinner label="Loading sharing settings" />
      </div>
    );
  }

  if (grants.isError) {
    return (
      <div className="share-voice-note__centre" role="alert">
        <p>Couldn&apos;t load who this recording is shared with.</p>
        <button
          type="button"
          className="share-voice-note__retry"
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

  function handleRevoke(row: VoiceShareResponse) {
    setConfirmingRevoke(row);
  }

  function confirmRevoke() {
    if (confirmingRevoke === null) return;

    const row = confirmingRevoke;
    setConfirmingRevoke(null);
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

  function handlePermissionChange(row: VoiceShareResponse, permission: SharePermission) {
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
      <ul className="share-voice-note__list" role="list">
        {rows.length === 0 ? (
          <li className="share-voice-note__empty">Not shared with anyone yet.</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="share-voice-note__row">
              <span className="share-voice-note__name">{resolveName(row.sharedWithUserId)}</span>

              <label className="share-voice-note__permission">
                <span className="share-voice-note__permission-label">Permission</span>
                <FormSelect
                  value={row.permission}
                  isDisabled={update.isPending && update.variables?.userId === row.sharedWithUserId}
                  onChange={(_event, value) => {
                    handlePermissionChange(row, value as SharePermission);
                  }}
                >
                  <option value="READ">Read only</option>
                  <option value="WRITE">Can edit</option>
                </FormSelect>
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
                <p className="share-voice-note__row-error" role="alert">
                  {rowErrors[row.sharedWithUserId]}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {confirmingRevoke !== null ? (
        <Modal
          icon={<UserMinusIcon aria-hidden="true" />}
          title="Remove this collaborator?"
          description={
            <>
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong> will lose access to
              this voice note.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setConfirmingRevoke(null);
            },
          }}
          primaryAction={{
            label: 'Remove',
            onClick: confirmRevoke,
          }}
          onClose={() => {
            setConfirmingRevoke(null);
          }}
        />
      ) : null}

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
                    : 'Could not share this recording. Check your connection and try again.',
                );
              },
            },
          );
        }}
      />

      {formError !== null ? (
        <p className="share-voice-note__form-error" role="alert">
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
 * Mirrors `ShareNotePage`'s own `ShareForm` exactly — a native `<select>`
 * over `candidates`, never `CollaboratorPicker`'s free-text search (that
 * component finds someone to INVITE; this form can only offer people
 * already through that gate). `resolveName` passed in rather than
 * re-deriving names here: one batch lookup at `ShareManager` level, not a
 * second one this form would otherwise need for its own option labels.
 */
function ShareForm({ candidates, resolveName, pending, onShare }: ShareFormProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    candidates[0]?.collaboratorId ?? null,
  );
  const [permission, setPermission] = useState<SharePermission>('READ');

  if (candidates.length === 0) {
    return (
      <p className="share-voice-note__no-candidates">
        Everyone who has accepted an invitation already has access. Invite someone new from{' '}
        <Link to={ROUTES.legacy.collaborations()}>Collaborations</Link> first, then come back here
        to share with them.
      </p>
    );
  }

  return (
    <form
      className="share-voice-note__form"
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

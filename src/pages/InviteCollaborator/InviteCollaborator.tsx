import { useMemo, useState } from 'react';
import { AngleLeftIcon, CheckIcon, EnvelopeIcon } from '@patternfly/react-icons';
import { Link } from 'react-router';

import { CollaboratorPicker } from '@/features/collaboration/components/CollaboratorPicker/CollaboratorPicker';
import { useSentCollaborations } from '@/features/collaboration/hooks/useCollaborations';
import { useCreateCollaboration } from '@/features/collaboration/hooks/useCollaborationMutations';
import type {
  CollaborationResponse,
  UserSummaryResponse,
} from '@/features/collaboration/types';
import { Modal } from '@/design-system/components/Modal/Modal';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './InviteCollaborator.css';

const NOTES_ROUTE = '/';

type ExistingRelationship =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED';

interface ExistingCollaboratorModalProps {
  user: UserSummaryResponse;
  relationship: ExistingRelationship;
  onClose: () => void;
}

export function InviteCollaboratorPage() {
  useDocumentTitle('Find people');

  const sent = useSentCollaborations();
  const create = useCreateCollaboration();

  const [justInvited, setJustInvited] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedExisting, setSelectedExisting] =
    useState<{
      user: UserSummaryResponse;
      status: 'PENDING' | 'ACCEPTED';
    } | null>(null);

  /**
   * Relationships are keyed by collaborator ID so that a search result
   * can be matched against an existing invitation/collaboration.
   *
   * IMPORTANT:
   * We deliberately do NOT pass these IDs into CollaboratorPicker.
   * Existing users must remain searchable.
   */
  const relationshipsByUserId = useMemo(() => {
    const map = new Map<number, CollaborationResponse>();

    for (const relationship of sent.data?.content ?? []) {
      map.set(relationship.collaboratorId, relationship);
    }

    return map;
  }, [sent.data?.content]);

  function handleSelect(user: UserSummaryResponse) {
    setError(null);

    const existing = relationshipsByUserId.get(user.id);

    /*
     * The person has already accepted the collaboration.
     *
     * Do not send another invitation. Instead, explain that the
     * collaboration already exists and send the user back to their notes,
     * where the actual note-sharing operation belongs.
     */
    if (existing?.status === 'ACCEPTED') {
      setSelectedExisting({
        user,
        status: 'ACCEPTED',
      });
      return;
    }

    /*
     * The invitation is still pending.
     *
     * Again, do not create another collaboration row.
     */
    if (existing?.status === 'PENDING') {
      setSelectedExisting({
        user,
        status: 'PENDING',
      });
      return;
    }

    /*
     * No existing relationship, or the previous relationship was rejected.
     *
     * The server is responsible for handling a rejected relationship
     * becoming pending again.
     */
    create.mutate(
      { collaboratorId: user.id },
      {
        onSuccess: () => {
          const name = getDisplayName(user);

          setJustInvited((current) => [name, ...current]);
        },

        onError: () => {
          setError(
            'Could not send that invitation. Check your connection and try again.',
          );
        },
      },
    );
  }

  function closeExistingModal() {
    setSelectedExisting(null);
  }

  return (
    <section className="invite-collaborator">
      <nav className="invite-collaborator__back">
        <Link to="/collaborations" aria-label="Back to Collaborations">
          <AngleLeftIcon aria-hidden="true" />
        </Link>
      </nav>

      <h1 className="invite-collaborator__title">
        Find people
      </h1>

      <p className="invite-collaborator__lead">
        Search for anyone on Notare. Invite new people or find
        collaborators you already work with.
      </p>

      <CollaboratorPicker onSelect={handleSelect} />

      {sent.isLoading ? (
        <p className="invite-collaborator__status">
          Loading your collaborations…
        </p>
      ) : null}

      {create.isPending ? (
        <p className="invite-collaborator__status">
          Sending invitation…
        </p>
      ) : null}

      {error !== null ? (
        <p
          className="invite-collaborator__error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {justInvited.length > 0 ? (
        <p
          className="invite-collaborator__status"
          role="status"
        >
          Invited {justInvited.join(', ')}.
        </p>
      ) : null}

      {selectedExisting !== null ? (
        <ExistingCollaboratorModal
          user={selectedExisting.user}
          relationship={selectedExisting.status}
          onClose={closeExistingModal}
        />
      ) : null}
    </section>
  );
}

function ExistingCollaboratorModal({
  user,
  relationship,
  onClose,
}: ExistingCollaboratorModalProps) {
  const isPending = relationship === 'PENDING';
  const displayName = getDisplayName(user);

  return (
    <Modal
      icon={isPending ? <EnvelopeIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
      title={isPending ? 'Invitation already sent' : "You’re already collaborators"}
      description={
        isPending ? (
          <>
            You have already invited <strong>{displayName}</strong>. Once
            they accept, you can share your notes with them from the note's
            Share menu.
          </>
        ) : (
          <>
            <strong>{displayName}</strong> is already one of your
            collaborators. To share a note with them, open the note you want
            to share and select Share.
          </>
        )
      }
      secondaryAction={{ label: 'Close', onClick: onClose }}
      primaryAction={{
        label: 'Go to my notes',
        href: NOTES_ROUTE,
        onClick: onClose,
      }}
      onClose={onClose}
    />
  );
}

function getDisplayName(user: UserSummaryResponse): string {
  return (
    `${user.firstName} ${user.lastName}`.trim() ||
    user.username
  );
}

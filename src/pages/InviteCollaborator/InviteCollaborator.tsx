import { useState } from 'react';
import { Link } from 'react-router';

import { CollaboratorPicker } from '@/features/collaboration/components/CollaboratorPicker/CollaboratorPicker';
import { useSentCollaborations } from '@/features/collaboration/hooks/useCollaborations';
import { useCreateCollaboration } from '@/features/collaboration/hooks/useCollaborationMutations';
import type { UserSummaryResponse } from '@/features/collaboration/types';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './InviteCollaborator.css';

/**
 * `/collaborations/invite` — architecture doc §4.2's "Find people" screen:
 * "user search (`query` param), invite". The FIRST of the two stages the
 * architecture doc keeps insisting on separately (§2.4: "you invite
 * someone, they accept, *then* you can share notes with them") — this
 * screen only ever sends `collaboratorId` (types.ts's own corrected doc
 * comment on `CreateCollaborationRequest`); it has no notion of a note at
 * all, on purpose.
 *
 * `excludeIds` is every person already in `sent`, regardless of status —
 * not just PENDING. The server's `UNIQUE(owner_id, collaborator_id)`
 * (NOTARE-SERVER.md §8) means a second invite to someone already ACCEPTED
 * or REJECTED cannot succeed either; there is no "re-invite" concept, so
 * excluding only pending rows would let the picker offer a person a second
 * invite would only 400 on.
 */
export function InviteCollaboratorPage() {
  useDocumentTitle('Find people');

  const sent = useSentCollaborations();
  const create = useCreateCollaboration();

  const [justInvited, setJustInvited] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const excludeIds = (sent.data?.content ?? []).map((row) => row.collaboratorId);

  function handleSelect(user: UserSummaryResponse) {
    setError(null);
    create.mutate(
      { collaboratorId: user.id },
      {
        onSuccess: () => {
          const name = `${user.firstName} ${user.lastName}`.trim() || user.username;
          setJustInvited((current) => [name, ...current]);
        },
        onError: () => {
          setError('Could not send that invitation. Check your connection and try again.');
        },
      },
    );
  }

  return (
    <section className="invite-collaborator">
      <nav className="invite-collaborator__back">
        <Link to="/collaborations">← Collaborations</Link>
      </nav>

      <h1 className="invite-collaborator__title">Find people</h1>
      <p className="invite-collaborator__lead">
        Invite someone to collaborate. Once they accept, you can share specific notes with them
        from that note&apos;s Share screen.
      </p>

      <CollaboratorPicker excludeIds={excludeIds} onSelect={handleSelect} />

      {error !== null ? (
        <p className="invite-collaborator__error" role="alert">
          {error}
        </p>
      ) : null}

      {justInvited.length > 0 ? (
        <p className="invite-collaborator__status" role="status">
          Invited {justInvited.join(', ')}.
        </p>
      ) : null}
    </section>
  );
}

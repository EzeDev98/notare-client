import { useState } from 'react';
import { Link } from 'react-router';

import {
  useReceivedCollaborations,
  useSentCollaborations,
} from '@/features/collaboration/hooks/useCollaborations';
import {
  useAcceptCollaboration,
  useCancelCollaboration,
  useRejectCollaboration,
} from '@/features/collaboration/hooks/useCollaborationMutations';
import type { CollaborationResponse, CollaborationStatus } from '@/features/collaboration/types';
import { isBadRequest } from '@/lib/http/errors';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Invitations.css';

type Tab = 'received' | 'sent';

/**
 * `/collaborations` (architecture doc §4.2: "tabs: Received / Sent; accept,
 * reject, cancel"). Closes the gap the audit flagged: the state machine
 * (types.ts), its HTTP surface (collaborationService.ts) and its query/
 * mutation hooks were all built and committed with nothing rendering them.
 *
 * A row here shows the OTHER PERSON and the invitation's status — nothing
 * about a note. A collaboration is a person-to-person relationship, not a
 * grant on any particular note (types.ts's own doc comment on
 * `CollaborationResponse` — this page previously displayed a `noteTitle`
 * and `permission` that don't exist on the real response; corrected before
 * the 9C invite flow was built on the same wrong assumption). Which notes
 * get shared with an accepted collaborator, and at what permission, is a
 * separate decision made later on `/notes/:id/share` (9D).
 *
 * ONE route with a local tab switch, not two routes (contrast with
 * `NoteTabs`, which deliberately IS route-per-tab because those are
 * different screens with different actions). Received and Sent are the
 * same kind of screen — a list of the same `CollaborationResponse` rows,
 * viewed from the other side — so a NavLink pair would create two URLs
 * for what the architecture doc itself specs as one.
 */
export function InvitationsPage() {
  useDocumentTitle('Collaborations');

  const [tab, setTab] = useState<Tab>('received');

  return (
    <section className="invitations">
      <header className="invitations__header">
        <h1>Collaborations</h1>
        <Link to="/collaborations/invite" className="invitations__invite-link">
          Invite someone
        </Link>
      </header>

      <div className="invitations__tabs" role="tablist" aria-label="Collaboration views">
        <button
          type="button"
          role="tab"
          id="invitations-tab-received"
          aria-selected={tab === 'received'}
          aria-controls="invitations-panel-received"
          className="invitations__tab"
          onClick={() => {
            setTab('received');
          }}
        >
          Received
        </button>
        <button
          type="button"
          role="tab"
          id="invitations-tab-sent"
          aria-selected={tab === 'sent'}
          aria-controls="invitations-panel-sent"
          className="invitations__tab"
          onClick={() => {
            setTab('sent');
          }}
        >
          Sent
        </button>
      </div>

      {tab === 'received' ? (
        <div
          id="invitations-panel-received"
          role="tabpanel"
          aria-labelledby="invitations-tab-received"
        >
          <ReceivedList />
        </div>
      ) : (
        <div id="invitations-panel-sent" role="tabpanel" aria-labelledby="invitations-tab-sent">
          <SentList />
        </div>
      )}
    </section>
  );
}

function ReceivedList() {
  const { data, isLoading, isError, refetch } = useReceivedCollaborations();
  const accept = useAcceptCollaboration();
  const reject = useRejectCollaboration();
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  function clearRowError(id: number) {
    setRowErrors((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function handleAccept(id: number) {
    clearRowError(id);
    accept.mutate(id, {
      onError: (error) => {
        setRowErrors((current) => ({ ...current, [id]: describeTransitionError(error) }));
      },
    });
  }

  function handleReject(id: number) {
    clearRowError(id);
    reject.mutate(id, {
      onError: (error) => {
        setRowErrors((current) => ({ ...current, [id]: describeTransitionError(error) }));
      },
    });
  }

  if (isLoading) {
    return (
      <div className="invitations__centre">
        <Spinner label="Loading received invitations" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="invitations__centre" role="alert">
        <p>Couldn&apos;t load your received invitations.</p>
        <button type="button" className="invitations__retry" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const rows = data?.content ?? [];

  if (rows.length === 0) {
    return (
      <div className="invitations__centre">
        <h2 className="invitations__empty-title">No invitations</h2>
        <p className="invitations__empty-body">
          When someone invites you to collaborate, it will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="invitations__list" role="list">
      {rows.map((row) => {
        const isPending = row.status === 'PENDING';
        const pendingThisRow =
          (accept.isPending && accept.variables === row.id) ||
          (reject.isPending && reject.variables === row.id);

        return (
          <li key={row.id} className="invitations__row">
            <div className="invitations__row-main">
              <p className="invitations__name">{ownerLabel(row)}</p>
              <p className="invitations__meta">
                <time dateTime={row.createdAt} title={formatServerDateTimeAbsolute(row.createdAt)}>
                  {formatServerDateTimeRelative(row.createdAt)}
                </time>
              </p>
              <StatusBadge status={row.status} />
            </div>

            {isPending ? (
              <div className="invitations__row-actions">
                <Button
                  variant="primary"
                  size="sm"
                  loading={accept.isPending && accept.variables === row.id}
                  disabled={pendingThisRow}
                  onClick={() => {
                    handleAccept(row.id);
                  }}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={reject.isPending && reject.variables === row.id}
                  disabled={pendingThisRow}
                  onClick={() => {
                    handleReject(row.id);
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : null}

            {rowErrors[row.id] ? (
              <p className="invitations__row-error" role="alert">
                {rowErrors[row.id]}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SentList() {
  const { data, isLoading, isError, refetch } = useSentCollaborations();
  const cancel = useCancelCollaboration();
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  function handleCancel(id: number) {
    setRowErrors((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    cancel.mutate(id, {
      onError: () => {
        setRowErrors((current) => ({
          ...current,
          [id]: 'Could not cancel this invitation. Check your connection and try again.',
        }));
      },
    });
  }

  if (isLoading) {
    return (
      <div className="invitations__centre">
        <Spinner label="Loading sent invitations" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="invitations__centre" role="alert">
        <p>Couldn&apos;t load your sent invitations.</p>
        <button type="button" className="invitations__retry" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const rows = data?.content ?? [];

  if (rows.length === 0) {
    return (
      <div className="invitations__centre">
        <h2 className="invitations__empty-title">No invitations sent</h2>
        <p className="invitations__empty-body">
          Invite someone to collaborate and it will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="invitations__list" role="list">
      {rows.map((row) => (
        <li key={row.id} className="invitations__row">
          <div className="invitations__row-main">
            <p className="invitations__name">{collaboratorLabel(row)}</p>
            <p className="invitations__meta">
              <time dateTime={row.createdAt} title={formatServerDateTimeAbsolute(row.createdAt)}>
                {formatServerDateTimeRelative(row.createdAt)}
              </time>
            </p>
            <StatusBadge status={row.status} />
          </div>

          {/*
            Cancel is valid from ANY status, not just PENDING
            (collaborationService.ts's own doc comment on
            cancelCollaboration) — it is the only revocation path, so an
            ACCEPTED grant still needs this button to be revocable at all.
          */}
          <div className="invitations__row-actions">
            <Button
              variant="danger"
              size="sm"
              loading={cancel.isPending && cancel.variables === row.id}
              disabled={cancel.isPending && cancel.variables === row.id}
              onClick={() => {
                handleCancel(row.id);
              }}
            >
              Cancel
            </Button>
          </div>

          {rowErrors[row.id] ? (
            <p className="invitations__row-error" role="alert">
              {rowErrors[row.id]}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: CollaborationStatus }) {
  return (
    <span className="invitations__badge" data-status={status}>
      {status === 'PENDING' ? 'Pending' : status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
    </span>
  );
}

function ownerLabel(row: CollaborationResponse): string {
  return `${row.owner.firstName} ${row.owner.lastName}`.trim() || row.owner.username;
}

function collaboratorLabel(row: CollaborationResponse): string {
  return (
    `${row.collaborator.firstName} ${row.collaborator.lastName}`.trim() ||
    row.collaborator.username
  );
}

/**
 * `isBadRequest` on accept/reject means the opposite-terminal-state case
 * (types.ts's own doc comment: accepting an already-rejected invite, or
 * vice versa) — the ONLY thing a 400 can mean on these two endpoints, per
 * the state machine. Everything else is a plain connectivity failure.
 */
function describeTransitionError(error: unknown): string {
  if (isBadRequest(error)) {
    return 'This invitation was already resolved. Refresh to see its current status.';
  }
  return 'Could not update this invitation. Check your connection and try again.';
}

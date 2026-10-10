import { useState } from 'react';
import { Link } from 'react-router';
import { EnvelopeIcon } from '@patternfly/react-icons';

import {
  useReceivedCollaborations,
  useSentCollaborations,
} from '@/features/collaboration/hooks/useCollaborations';
import {
  useAcceptCollaboration,
  useCancelCollaboration,
  useRejectCollaboration,
} from '@/features/collaboration/hooks/useCollaborationMutations';
import type { CollaborationStatus } from '@/features/collaboration/types';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { isBadRequest } from '@/lib/http/errors';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { BackButton } from '@/design-system/components/BackButton/BackButton';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Invitations.css';
import { ROUTES } from '@/app/routes';

type Tab = 'received' | 'sent';

export function InvitationsPage() {
  useDocumentTitle('Collaborations');

  const [tab, setTab] = useState<Tab>('received');

  return (
    <section className="invitations">
      <BackButton />
      <header className="invitations__header">
        <h1>Collaborations</h1>
        <Link to={ROUTES.legacy.collaborationsInvite()} className="invitations__invite-link">
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
  const [confirmingRejectId, setConfirmingRejectId] = useState<number | null>(null);

  const rowsForNames = data?.content ?? [];
  const { profiles, isLoading: namesLoading } = useUserLookup(
    rowsForNames.map((row) => row.ownerId),
  );

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
    setConfirmingRejectId(id);
  }

  function confirmReject() {
    if (confirmingRejectId === null) return;

    const id = confirmingRejectId;
    setConfirmingRejectId(null);
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
    <>
      <ul className="invitations__list" role="list">
      {rows.map((row) => {
        const isPending = row.status === 'PENDING';
        const pendingThisRow =
          (accept.isPending && accept.variables === row.id) ||
          (reject.isPending && reject.variables === row.id);

        return (
          <li key={row.id} className="invitations__row">
            <div className="invitations__row-main">
              <p className="invitations__name">
                {namesLoading ? `User ${String(row.ownerId)}` : formatUserName(profiles.get(row.ownerId))}
              </p>
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

    {confirmingRejectId !== null ? (
      <Modal
        icon={<EnvelopeIcon aria-hidden="true" />}
        description="Reject this invite? You won't get access to this invitation."
        secondaryAction={{
          label: 'Cancel',
          onClick: () => {
            setConfirmingRejectId(null);
          },
        }}
        primaryAction={{
          label: 'Reject',
          onClick: confirmReject,
        }}
        onClose={() => {
          setConfirmingRejectId(null);
        }}
      />
    ) : null}
    </>
  );
}

function SentList() {
  const { data, isLoading, isError, refetch } = useSentCollaborations();
  const cancel = useCancelCollaboration();
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);

  const rowsForNames = data?.content ?? [];
  const { profiles, isLoading: namesLoading } = useUserLookup(
    rowsForNames.map((row) => row.collaboratorId),
  );

  function handleCancel(id: number) {
    setConfirmingCancelId(id);
  }

  function confirmCancel() {
    if (confirmingCancelId === null) return;

    const id = confirmingCancelId;
    setConfirmingCancelId(null);
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
    <>
      <ul className="invitations__list" role="list">
      {rows.map((row) => (
        <li key={row.id} className="invitations__row">
          <div className="invitations__row-main">
            <p className="invitations__name">
              {namesLoading
                ? `User ${String(row.collaboratorId)}`
                : formatUserName(profiles.get(row.collaboratorId))}
            </p>
            <p className="invitations__meta">
              <time dateTime={row.createdAt} title={formatServerDateTimeAbsolute(row.createdAt)}>
                {formatServerDateTimeRelative(row.createdAt)}
              </time>
            </p>
            <StatusBadge status={row.status} />
          </div>

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

    {confirmingCancelId !== null ? (
      <Modal
        icon={<EnvelopeIcon aria-hidden="true" />}
        description="Cancel this invite? This invitation will no longer be available to the recipient."
        secondaryAction={{
          label: 'Keep invite',
          onClick: () => {
            setConfirmingCancelId(null);
          },
        }}
        primaryAction={{
          label: 'Cancel invite',
          onClick: confirmCancel,
        }}
        onClose={() => {
          setConfirmingCancelId(null);
        }}
      />
    ) : null}
    </>
  );
}

function StatusBadge({ status }: { status: CollaborationStatus }) {
  return (
    <span className="invitations__badge" data-status={status}>
      {status === 'PENDING' ? 'Pending' : status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
    </span>
  );
}

function describeTransitionError(error: unknown): string {
  if (isBadRequest(error)) {
    return 'This invitation was already resolved. Refresh to see its current status.';
  }
  return 'Could not update this invitation. Check your connection and try again.';
}

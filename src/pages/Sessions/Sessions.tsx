import { useState } from 'react';
import { LogOut, MonitorSmartphone, TriangleAlert } from 'lucide-react';

import { useAuth } from '@/app/providers/auth-context';
import { attemptFinalSync, wipeLocalState } from '@/app/hardReset';
import { useSessions } from '@/features/auth/hooks/useSessions';
import { BackButton } from '@/design-system/components/BackButton/BackButton';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { formatInstantAbsolute, formatInstantRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Sessions.css';

type Confirmation =
  | {
      type: 'session';
      sessionId: string;
    }
  | {
      type: 'all';
    }
  | {
      type: 'reset';
    }
  | {
      /*
       * A second, sterner confirmation, reached only from the first one —
       * see handleReset's own comment for why this needs to be a distinct
       * step rather than a single "are you sure" gate.
       */
      type: 'reset-unsynced';
    }
  | null;

/**
 * What handleReset shows in place of the confirmation buttons while it runs
 * — a plain status string rather than a boolean, since "syncing" and
 * "erasing" are different enough moments that a single `busy` spinner with
 * no label reads as the app having hung, particularly for the erase step,
 * which can legitimately take a couple of seconds (unregistering the
 * service worker, deleting every cache entry, deleting both databases).
 */
type ResetStage = 'idle' | 'syncing' | 'erasing';

export function SessionsPage() {
  useDocumentTitle('Sessions');

  const { state: authState, logout } = useAuth();
  const { sessions, error, revoke, revokeAll } = useSessions();

  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [busy, setBusy] = useState(false);
  const [resetStage, setResetStage] = useState<ResetStage>('idle');

  const confirmingSession =
    confirmation?.type === 'session'
      ? sessions?.find(
          (session) => session.sessionId === confirmation.sessionId,
        ) ?? null
      : null;

  async function handleRevoke(
    sessionId: string,
    isCurrent: boolean,
  ): Promise<void> {
    setBusy(true);

    try {
      if (isCurrent) {
        /*
         * Revoking your own session is a logout and must be handled as one.
         * The auth provider clears the local authentication state after
         * logging out rather than leaving the application with a deleted
         * server-side session.
         */
        await logout();
        return;
      }

      await revoke(sessionId);
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  }

  async function handleRevokeAll(): Promise<void> {
    setBusy(true);

    try {
      await revokeAll();
      await logout();
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  }

  function closeConfirmation() {
    if (busy) return;
    setConfirmation(null);
  }

  /**
   * "Reset this device" — a full local teardown (hardReset.ts), reached
   * through TWO confirmations, not one, when there is a reason for a
   * second: the first click ('reset') is the ordinary "are you sure";
   * `attemptFinalSync` runs immediately after it, and only if THAT still
   * leaves unsynced changes behind (this device is offline, or the sync
   * itself failed) does a second, sterner confirmation ('reset-unsynced')
   * ask the person to knowingly discard those specific changes rather than
   * silently doing it for them.
   *
   * `force` is what the second confirmation's own primary action passes —
   * "yes, I understand, erase anyway" — skipping straight to the wipe
   * without re-running the sync attempt a second time.
   */
  async function handleReset(force = false): Promise<void> {
    setBusy(true);

    try {
      if (!force) {
        setResetStage('syncing');
        const { hadUnsyncedChanges } = await attemptFinalSync(ownerId);

        if (hadUnsyncedChanges) {
          setResetStage('idle');
          setConfirmation({ type: 'reset-unsynced' });
          setBusy(false);
          return;
        }
      }

      setResetStage('erasing');

      /*
       * Logout BEFORE the wipe, deliberately — it needs the refresh token
       * that still lives in the auth database to revoke the session on the
       * server. Swallowed the same way AuthProvider's own logout() already
       * does: a person who asked to reset this device must end up reset
       * whether or not the server call succeeded, not stuck mid-reset
       * because their connection dropped at the worst possible moment.
       */
      await logout().catch(() => {
        // See above — local teardown proceeds regardless.
      });

      await wipeLocalState();

      /*
       * A full navigation, not a client-side route change or a plain
       * reload: the service worker registration this tab was controlled
       * by was just unregistered, and only a real navigation guarantees
       * the next request goes to the network rather than a worker that
       * hasn't noticed its own unregistration yet. Landing on "/" rather
       * than staying on whatever page this was is the "clean slate" the
       * reset promises — there is no session left for this URL to mean
       * anything against.
       */
      window.location.href = '/';
    } finally {
      // Only reached if something above threw before the navigation — the
      // happy path never returns here, since window.location.href = '/'
      // tears this component down along with everything else on the page.
      setBusy(false);
      setResetStage('idle');
      setConfirmation(null);
    }
  }

  return (
    <section className="sessions">
      <BackButton />
      <h1>Sessions</h1>

      <p className="sessions__lead">
        Devices and browsers currently signed in to your account.
      </p>

      {error !== null ? (
        <p className="sessions__error" role="alert">
          {error}
        </p>
      ) : null}

      {sessions === null && error === null ? (
        <Spinner label="Loading your sessions" />
      ) : null}

      {sessions !== null ? (
        <ul className="sessions__list" role="list">
          {sessions.map((session) => (
            <li className="sessions__item" key={session.sessionId}>
              <div className="sessions__detail">
                <p className="sessions__device">
                  {session.userAgent ?? 'Unknown device'}

                  {session.current ? (
                    <span className="sessions__badge">
                      This device
                    </span>
                  ) : null}
                </p>

                <p
                  className="sessions__meta"
                  title={formatInstantAbsolute(session.lastUsedAt)}
                >
                  Last used {formatInstantRelative(session.lastUsedAt)}
                  {session.ipAddress !== null
                    ? ` · ${session.ipAddress}`
                    : ''}
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirmation({
                    type: 'session',
                    sessionId: session.sessionId,
                  });
                }}
              >
                {session.current ? 'Sign out' : 'Revoke'}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        Both destructive, account-wide actions share one row: "Sign out
        everywhere" (ends every session, leaves this device's cached notes
        and drafts in place) on the left, "Reset this device" (also wipes
        those local notes/drafts/cache on THIS device) on the right. Each
        button's own explanation is revealed on hover rather than sitting
        on the page permanently — see .sessions__danger-hint's own comment
        for why hover rather than a persistent line or a native tooltip.
      */}
      <div className="sessions__danger-zone">
        <div className="sessions__danger-action">
          <Button
            variant="danger"
            onClick={() => {
              setConfirmation({ type: 'all' });
            }}
          >
            Sign out everywhere
          </Button>

          <p className="sessions__meta sessions__danger-hint">
            Ends every session, including this one. Use this if you have
            lost a device.
          </p>
        </div>

        <div className="sessions__danger-action sessions__danger-action--reset">
          <Button
            variant="danger"
            onClick={() => {
              setConfirmation({ type: 'reset' });
            }}
          >
            Reset this device
          </Button>

          <p className="sessions__meta sessions__danger-hint">
            Erases local notes and cache on this device only, then signs you
            out.
          </p>
        </div>
      </div>

      {confirmation?.type === 'session' && confirmingSession !== null ? (
        <Modal
          icon={
            confirmingSession.current ? (
              <LogOut aria-hidden="true" />
            ) : (
              <MonitorSmartphone aria-hidden="true" />
            )
          }
          description={
            confirmingSession.current ? (
              <>
                Sign out from this device? You will be signed out and returned
                to the login screen.
              </>
            ) : (
              <>
                Revoke this session? This device or browser will no longer be
                able to access your Notare account using this session.
              </>
            )
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeConfirmation,
          }}
          primaryAction={{
            label: confirmingSession.current ? 'Sign out' : 'Revoke',
            onClick: () => {
              void handleRevoke(
                confirmingSession.sessionId,
                confirmingSession.current,
              );
            },
          }}
          onClose={closeConfirmation}
        />
      ) : null}

      {confirmation?.type === 'all' ? (
        <Modal
          icon={<LogOut aria-hidden="true" />}
          description={
            <>
              Sign out everywhere? This will end every active session,
              including the device you are using now. You will need to sign
              in again.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeConfirmation,
          }}
          primaryAction={{
            label: 'Sign out everywhere',
            onClick: () => {
              void handleRevokeAll();
            },
          }}
          onClose={closeConfirmation}
        />
      ) : null}

      {confirmation?.type === 'reset' ? (
        <Modal
          icon={<TriangleAlert aria-hidden="true" />}
          title="Reset this device?"
          description={
            <>
              This deletes every note, draft, and cached file this browser
              has stored locally, and signs you out. Notare will first try
              to sync any unsent changes so nothing is lost — this can take
              a few seconds. Your account and everything already on the
              server are unaffected.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeConfirmation,
          }}
          primaryAction={{
            label: 'Reset device',
            onClick: () => {
              void handleReset();
            },
          }}
          onClose={closeConfirmation}
        />
      ) : null}

      {confirmation?.type === 'reset-unsynced' ? (
        <Modal
          icon={<TriangleAlert aria-hidden="true" />}
          title="Unsynced changes remain"
          description={
            <>
              Notare tried to sync before resetting, but some local changes
              still have not reached the server — most likely because this
              device is offline right now. Resetting anyway will permanently
              lose them. Cancel and try again once you are back online, or
              reset anyway and discard them.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeConfirmation,
          }}
          primaryAction={{
            label: 'Reset anyway',
            onClick: () => {
              void handleReset(true);
            },
          }}
          onClose={closeConfirmation}
        />
      ) : null}

      {resetStage !== 'idle' ? (
        <div className="sessions__reset-progress" role="status">
          <Spinner
            label={
              resetStage === 'syncing'
                ? 'Syncing your changes before resetting…'
                : 'Erasing local data…'
            }
          />
        </div>
      ) : null}
    </section>
  );
}
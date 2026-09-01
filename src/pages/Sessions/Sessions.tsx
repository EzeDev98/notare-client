import { useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';

import { useAuth } from '@/app/providers/auth-context';
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
  | null;

export function SessionsPage() {
  useDocumentTitle('Sessions');

  const { logout } = useAuth();
  const { sessions, error, revoke, revokeAll } = useSessions();

  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [busy, setBusy] = useState(false);

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
        "Reset this device" used to share this row — it now lives in the
        sidebar, directly under Accounts (AppLayout.tsx), so this is just
        the one remaining destructive, account-wide action. Its own
        explanation is revealed on hover rather than sitting on the page
        permanently — see .sessions__danger-hint's own comment for why
        hover rather than a persistent line or a native tooltip.
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
              This will end every active session,
              including the device you are using now. You will need to sign
              in again.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeConfirmation,
          }}
          primaryAction={{
            label: 'Sign out',
            onClick: () => {
              void handleRevokeAll();
            },
          }}
          onClose={closeConfirmation}
        />
      ) : null}
    </section>
  );
}
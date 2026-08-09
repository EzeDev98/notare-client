import { useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { useSessions } from '@/features/auth/hooks/useSessions';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { formatInstantAbsolute, formatInstantRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Sessions.css';

export function SessionsPage() {
  useDocumentTitle('Sessions');

  const { logout } = useAuth();
  const { sessions, error, revoke, revokeAll } = useSessions();

  /*
   * Inline confirmation instead of a modal: 2D deferred Modal and it still has
   * no other consumer, so building one here would be designing against a
   * single use. A two-step button needs no focus trap, no scroll lock and no
   * portal.
   */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRevoke(sessionId: string, isCurrent: boolean): Promise<void> {
    setBusy(true);
    try {
      if (isCurrent) {
        /*
         * Revoking your OWN session is a logout, and must be handled as one.
         *
         * Treating it as an ordinary row means the delete succeeds, the next
         * request 401s, the refresh fails against a record that no longer
         * exists, and the user is bounced to login with no idea why. The
         * `current` flag exists precisely so the client can avoid that.
         */
        await logout();
        return;
      }
      await revoke(sessionId);
    } finally {
      setBusy(false);
      setConfirmingId(null);
    }
  }

  return (
    <section className="sessions">
      <h1>Sessions</h1>
      <p className="sessions__lead">Devices and browsers currently signed in to your account.</p>

      {error !== null ? (
        <p className="sessions__error" role="alert">
          {error}
        </p>
      ) : null}

      {sessions === null && error === null ? <Spinner label="Loading your sessions" /> : null}

      {sessions !== null ? (
        <ul className="sessions__list" role="list">
          {sessions.map((session) => (
            <li className="sessions__item" key={session.sessionId}>
              <div className="sessions__detail">
                <p className="sessions__device">
                  {session.userAgent ?? 'Unknown device'}
                  {session.current ? (
                    // Text, not just a colour — §36.
                    <span className="sessions__badge">This device</span>
                  ) : null}
                </p>

                {/*
                  Session timestamps are Instant — real UTC with a Z — so
                  new Date() is correct on them, unlike every other timestamp
                  in this API. title gives the absolute value on hover, since
                  "3 days ago" is friendly but imprecise.
                */}
                <p className="sessions__meta" title={formatInstantAbsolute(session.lastUsedAt)}>
                  Last used {formatInstantRelative(session.lastUsedAt)}
                  {session.ipAddress !== null ? ` · ${session.ipAddress}` : ''}
                </p>
              </div>

              {confirmingId === session.sessionId ? (
                <div className="sessions__confirm">
                  <Button
                    variant="danger"
                    size="sm"
                    loading={busy}
                    onClick={() => void handleRevoke(session.sessionId, session.current)}
                  >
                    {session.current ? 'Sign out here' : 'Confirm'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmingId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setConfirmingId(session.sessionId);
                  }}
                >
                  {session.current ? 'Sign out' : 'Revoke'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="sessions__all">
        <Button
          variant="danger"
          onClick={() => {
            void revokeAll().then(() => logout());
          }}
        >
          Sign out everywhere
        </Button>
        <p className="sessions__meta">
          Ends every session, including this one. Use this if you have lost a device.
        </p>
      </div>
    </section>
  );
}

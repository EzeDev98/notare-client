import { useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { Button, InfoBanner, Overlay, PasswordField, TextField, useToast } from '@/design-system/ui';
import { sessionUserOf } from '@/features/auth/sessionUser';
import { isOffline, isUnauthorized } from '@/lib/http/errors';

import { STATUS_COPY } from './statusContent';

const COPY = STATUS_COPY.signIn;

interface SignInAgainModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Sign in again" (step 14a): the username is fixed, only the password is asked
 * for, and the screen behind never unmounts, so nothing the person was writing is lost.
 */
export function SignInAgainModal({ open, onClose }: SignInAgainModalProps) {
  const { state, reauthenticate } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const close = (): void => {
    if (busy) return;
    setPassword('');
    setFieldError(undefined);
    setProblem(undefined);
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (busy) return;
    setFieldError(undefined);
    setProblem(undefined);
    if (password === '') {
      setFieldError(COPY.passwordRequired);
      return;
    }

    setBusy(true);
    try {
      await reauthenticate(password);
      toast(COPY.done, { tone: 'success' });
      setPassword('');
      onClose();
    } catch (reason) {
      if (isUnauthorized(reason)) setFieldError(COPY.wrongPassword);
      else setProblem(isOffline(reason) ? COPY.cannotReach : COPY.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={close}
      title={COPY.title}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={close}>
            {COPY.cancel}
          </Button>
          <Button
            variant="primary"
            busy={busy}
            onClick={() => {
              void submit();
            }}
          >
            {COPY.submit}
          </Button>
        </>
      }
    >
      <div className="set__stack set__stack--tight">
        <p>{COPY.note}</p>
        {problem ? <InfoBanner tone="error">{problem}</InfoBanner> : null}
        <TextField
          label={COPY.username}
          value={sessionUserOf(state)?.username ?? ''}
          readOnly
          autoComplete="username"
        />
        <PasswordField
          label={COPY.password}
          value={password}
          autoComplete="current-password"
          data-autofocus=""
          {...(fieldError ? { error: fieldError } : {})}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            void submit();
          }}
        />
      </div>
    </Overlay>
  );
}

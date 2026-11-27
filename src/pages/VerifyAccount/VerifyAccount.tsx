/** Check-your-email screen after registering. */
import { Mail } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { Button, FormScreen, IconTile, TextField, useToast } from '@/design-system/ui';
import {
  CHECK_EMAIL,
  CHECK_EMAIL_MESSAGES,
  ERRORS,
  RESEND_COOLDOWN_SECONDS,
} from '@/features/auth/authContent';
import { useAccountVerification } from '@/features/auth/hooks/useAccountVerification';
import { maskEmail } from '@/features/auth/maskEmail';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

function readState(state: unknown): { identifier: string; justSent: boolean } {
  if (typeof state !== 'object' || state === null) return { identifier: '', justSent: false };
  const value = state as { identifier?: unknown; justSent?: unknown };
  return {
    identifier: typeof value.identifier === 'string' ? value.identifier : '',
    justSent: value.justSent === true,
  };
}

export function VerifyAccountPage() {
  useDocumentTitle(CHECK_EMAIL.title);

  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { toast } = useToast();
  const verification = useAccountVerification();

  const { identifier: initialIdentifier, justSent } = readState(location.state);
  const cooldown = useCountdown(justSent ? RESEND_COOLDOWN_SECONDS : 0);

  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [error, setError] = useState<string | undefined>(undefined);
  const [resending, setResending] = useState(false);
  const identifierRef = useRef<HTMLInputElement>(null);

  const lost = initialIdentifier === '';
  const showsAddress = initialIdentifier.includes('@');

  async function handleResend(): Promise<void> {
    if (resending || cooldown.remaining > 0) return;

    const value = identifier.trim();
    if (value === '') {
      setError(CHECK_EMAIL_MESSAGES.identifierRequired);
      identifierRef.current?.focus();
      return;
    }
    if (!online) {
      toast(ERRORS.offline, { tone: 'error' });
      return;
    }

    setResending(true);
    await verification.resend(value);
    setResending(false);
    cooldown.start(RESEND_COOLDOWN_SECONDS);
    toast(CHECK_EMAIL_MESSAGES.resentToast, { tone: 'success' });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void handleResend();
  }

  return (
    <FormScreen
      title={CHECK_EMAIL.title}
      description={
        showsAddress
          ? CHECK_EMAIL.description(maskEmail(initialIdentifier))
          : CHECK_EMAIL.descriptionLost
      }
      hero={<IconTile icon={Mail} />}
      onBack={() => {
        void navigate(ROUTES.signIn(), { replace: true });
      }}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button
            variant="primary"
            block
            onClick={() => {
              void navigate(ROUTES.signIn(), { replace: true });
            }}
          >
            {CHECK_EMAIL_MESSAGES.goToSignIn}
          </Button>
          <Button
            variant="ghost"
            block
            busy={resending}
            disabled={cooldown.remaining > 0}
            onClick={() => void handleResend()}
          >
            {cooldown.remaining > 0 ? CHECK_EMAIL.resendIn(cooldown.remaining) : CHECK_EMAIL.resend}
          </Button>
        </>
      }
    >
      {lost ? (
        <TextField
          ref={identifierRef}
          label={CHECK_EMAIL.identifierLabel}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          submitting={resending}
          value={identifier}
          {...(error ? { error } : {})}
          onChange={(event) => {
            setIdentifier(event.target.value);
            setError(undefined);
          }}
        />
      ) : null}
    </FormScreen>
  );
}

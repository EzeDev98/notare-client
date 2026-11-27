/** Sign-in screen. */
import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { ROUTES } from '@/app/routes';
import { FormScreen } from '@/design-system/components/layout/FormScreen';
import { Button } from '@/design-system/ui/Button/Button';
import { InfoBanner } from '@/design-system/ui/InfoBanner/InfoBanner';
import { Link } from '@/design-system/ui/Link/Link';
import { PasswordField } from '@/design-system/ui/PasswordField/PasswordField';
import { TextField } from '@/design-system/ui/TextField/TextField';
import {
  ERRORS,
  LOGIN,
  LOGIN_FIELD_ERRORS,
  SESSION_BANNERS,
  VERIFIED_BANNER,
} from '@/features/auth/authContent';
import { fieldErrors, isForbidden, isOffline, isUnauthorized, statusOf } from '@/lib/http/errors';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './Login.css';

type Problem = { kind: 'message'; text: string } | { kind: 'unverified' };

function readVerified(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false;
  return (state as { verified?: unknown }).verified === true;
}

export function LoginPage() {
  useDocumentTitle(LOGIN.title);

  const { state: authState, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (authState.status === 'authenticated' || authState.status === 'refreshing') {
    return <Navigate to={ROUTES.notes()} replace />;
  }

  const fieldError = (name: string): { error?: string } => {
    const message = errors[name];
    return message ? { error: message } : {};
  };

  const banner =
    authState.status === 'session-expired'
      ? SESSION_BANNERS[authState.reason === 'revoked' ? 'revoked' : 'expired']
      : null;

  function goToVerify(): void {
    void navigate(ROUTES.verify(), { state: { identifier: usernameOrEmail.trim() } });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: Record<string, string> = {};
    if (usernameOrEmail.trim() === '') {
      nextErrors['usernameOrEmail'] = LOGIN_FIELD_ERRORS.identifierRequired;
    }
    if (password === '') {
      nextErrors['password'] = LOGIN_FIELD_ERRORS.passwordRequired;
    }

    setErrors(nextErrors);
    setProblem(null);
    if (Object.keys(nextErrors).length > 0) {
      (nextErrors['usernameOrEmail'] ? identifierRef : passwordRef).current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login({ usernameOrEmail: usernameOrEmail.trim(), password });
      void navigate(ROUTES.notes(), { replace: true });
    } catch (error) {
      if (isUnauthorized(error)) {
        setProblem({ kind: 'message', text: ERRORS.wrongCredentials });
        setPassword('');
        passwordRef.current?.focus();
      } else if (isForbidden(error)) {
        setProblem({ kind: 'unverified' });
      } else if (statusOf(error) === 423) {
        setProblem({ kind: 'message', text: ERRORS.accountUnavailable });
      } else if (isOffline(error)) {
        setProblem({ kind: 'message', text: ERRORS.offline });
      } else {
        const serverFields = fieldErrors(error);
        if (serverFields) {
          setErrors(serverFields);
        } else {
          setProblem({ kind: 'message', text: ERRORS.generic });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormScreen
      title={LOGIN.title}
      description={LOGIN.description}
      onBack={() => {
        void navigate(ROUTES.welcome());
      }}
      onSubmit={(event) => void handleSubmit(event)}
      footer={
        <>
          {problem?.kind === 'message' ? <InfoBanner tone="error">{problem.text}</InfoBanner> : null}
          {problem?.kind === 'unverified' ? (
            <InfoBanner
              tone="error"
              action={
                <Button variant="secondary" onClick={goToVerify}>
                  {ERRORS.notVerifiedAction}
                </Button>
              }
            >
              {ERRORS.notVerified}
            </InfoBanner>
          ) : null}
          <Button type="submit" variant="primary" block busy={submitting}>
            {LOGIN.submit}
          </Button>
          <p className="login__reset">
            <Link to={ROUTES.resetPassword()}>{LOGIN.resetLink}</Link>
          </p>
        </>
      }
    >
      {banner ? (
        <InfoBanner title={banner.title}>{banner.text}</InfoBanner>
      ) : readVerified(location.state) ? (
        <InfoBanner>{VERIFIED_BANNER}</InfoBanner>
      ) : null}

      <TextField
        ref={identifierRef}
        label={LOGIN.labels.identifier}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        submitting={submitting}
        value={usernameOrEmail}
        {...fieldError('usernameOrEmail')}
        onChange={(event) => {
          setUsernameOrEmail(event.target.value);
          setErrors((current) => ({ ...current, usernameOrEmail: '' }));
          setProblem(null);
        }}
      />

      <PasswordField
        ref={passwordRef}
        label={LOGIN.labels.password}
        autoComplete="current-password"
        submitting={submitting}
        value={password}
        {...fieldError('password')}
        onChange={(event) => {
          setPassword(event.target.value);
          setErrors((current) => ({ ...current, password: '' }));
          setProblem(null);
        }}
      />
    </FormScreen>
  );
}

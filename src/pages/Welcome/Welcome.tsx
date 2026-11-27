/** First screen when signed out: create an account or sign in. */
import { Navigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { useTheme } from '@/app/providers/theme-context';
import { ROUTES } from '@/app/routes';
import { ScreenContainer } from '@/design-system/components/layout/ScreenContainer';
import { ScreenHead } from '@/design-system/components/layout/ScreenHead';
import { Button } from '@/design-system/ui/Button/Button';
import { Logo } from '@/design-system/ui/Logo/Logo';
import { WELCOME } from '@/features/auth/authContent';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './Welcome.css';

export function WelcomePage() {
  useDocumentTitle(WELCOME.title);

  const { state: authState } = useAuth();
  const { resolved } = useTheme();

  if (authState.status === 'authenticated' || authState.status === 'refreshing') {
    return <Navigate to={ROUTES.notes()} replace />;
  }

  return (
    <ScreenContainer bar={<span aria-hidden="true" />}>
      <div className="welcome__body">
        <Logo scheme={resolved} size="lg" />
        <ScreenHead title={WELCOME.title} description={WELCOME.description} />
      </div>
      <div className="welcome__footer">
        <Button variant="primary" block to={ROUTES.register()}>
          {WELCOME.createAccount}
        </Button>
        <Button variant="secondary" block to={ROUTES.signIn()}>
          {WELCOME.signIn}
        </Button>
      </div>
    </ScreenContainer>
  );
}

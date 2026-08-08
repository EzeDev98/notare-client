import { Button } from '@/design-system/components/Button/Button';
import { TextField } from '@/design-system/components/TextField/TextField';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

/** Placeholder. Real validation and the auth flow arrive in Step 4B. */
export function LoginPage() {
  useDocumentTitle('Sign in');

  return (
    <>
      <h1>Sign in</h1>
      <div style={{ display: 'grid', gap: 'var(--space-4)', marginBlockStart: 'var(--space-6)' }}>
        <TextField label="Username or email" autoComplete="username" />
        <TextField label="Password" type="password" autoComplete="current-password" />
        <Button variant="primary">Sign in</Button>
      </div>
    </>
  );
}

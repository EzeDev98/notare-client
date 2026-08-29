import type { SplashStage } from '@/app/useBootPhase';
import './AppSplash.css';

interface AppSplashProps {
  stage: SplashStage;
}

/**
 * Step 10b. Deliberately no logo here — see useBootPhase.ts's own note
 * on why. Just the tagline, dots, and footer.
 */
export function AppSplash({ stage }: AppSplashProps) {
  return (
    <div
      className="app-splash"
      data-testid="app-splash"
      data-stage={stage}
      role="status"
      aria-live="polite"
    >
      <p className="app-splash__tagline">Write Anywhere. Sync Everywhere.</p>
      <span className="app-splash__dots" aria-hidden="true">
        <span className="app-splash__dot" />
        <span className="app-splash__dot" />
        <span className="app-splash__dot" />
      </span>
      <p className="app-splash__footer">Local-First &bull; Reliable &bull; Always Synced</p>
    </div>
  );
}

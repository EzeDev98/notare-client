import type { SplashStage } from '@/app/useBootPhase';
import { Logo } from '@/design-system/components/Logo/Logo';
import './AppSplash.css';

interface AppSplashProps {
  stage: SplashStage;
}

export function AppSplash({ stage }: AppSplashProps) {
  const showBrand = stage !== 'logo';

  return (
    <div className="app-splash" data-testid="app-splash" data-stage={stage} role="status" aria-live="polite">
      <Logo withWordmark={showBrand} className="app-splash__logo" />

      {showBrand ? (
        <div className="app-splash__brand">
          <p className="app-splash__tagline">Write Anywhere. Sync Everywhere.</p>
          <span className="app-splash__dots" aria-hidden="true">
            <span className="app-splash__dot" />
            <span className="app-splash__dot" />
            <span className="app-splash__dot" />
          </span>
          <p className="app-splash__footer">Local-First &bull; Reliable &bull; Always Synced</p>
        </div>
      ) : null}
    </div>
  );
}

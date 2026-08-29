import type { SplashStage } from '@/app/useBootPhase';
import './AppSplash.css';

interface AppSplashProps {
  stage: SplashStage;
}

/**
 * Step 12. logo-mark.png (generated alongside the other brand assets —
 * see the recolor script) is a true transparent cutout of just the
 * leaf, no card/background baked in, unlike Logo.tsx's own asset —
 * that's the whole reason this doesn't reuse <Logo>. One flat colour
 * reads fine on either theme's --color-bg, so no light/dark swap here.
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
      <img className="app-splash__logo" src="/logo-mark.png" alt="" width={512} height={512} />
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

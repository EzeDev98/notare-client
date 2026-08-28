import { Logo } from '@/design-system/components/Logo/Logo';
import './AppSplash.css';

/**
 * Step 2. The first thing rendered on every cold start (Image 5/4 in the
 * spec) — before AuthProvider has resolved a session, before we know
 * whether install is required, before anything else on screen. Mounted
 * for as long as boot actually takes; Step 4 controls its lifetime, this
 * component only renders what it looks like.
 *
 * Step 2a: mark + wordmark. Uses the existing Logo component exactly as
 * the sidebar/header do, at a larger size for a splash's centred-hero
 * treatment — no new asset, the fixed logo-light/logo-dark PNG pair
 * already covers both themes.
 *
 * Step 2b (tagline) and 2c (animated loading dots) land in the same
 * file next; this is the 2a slice only.
 */
export function AppSplash() {
  return (
    <div className="app-splash" role="status" aria-live="polite">
      <Logo withWordmark className="app-splash__logo" />
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

import { AnimatedRoutes } from '@/app/AnimatedRoutes';

import './PublicLayout.css';

/**
 * Chrome for unauthenticated screens: login, register, OTP, password reset.
 *
 * A separate layout rather than a variant of AppLayout because these screens
 * have genuinely different needs — no navigation, a single centred column, and
 * a keyboard open most of the time. It is also the boundary Step 4D guards: a
 * route is public or protected by virtue of which of these it sits under.
 */
export function PublicLayout() {
  return (
    <main className="public-shell" id="public-main" tabIndex={-1}>
      <div className="public-shell__panel">
        <AnimatedRoutes />
      </div>
    </main>
  );
}

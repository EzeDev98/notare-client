import { Outlet } from 'react-router';

/**
 * Chrome for unauthenticated screens: login, register, OTP, password reset.
 *
 * Separate from AppLayout because these screens have no sidebar, no sync
 * status and no notification bell — and because this is the boundary Step 4D
 * guards. A route's placement in this tree is what makes it public or
 * protected, rather than a check somewhere inside the page.
 */
export function PublicLayout() {
  return (
    <main>
      <Outlet />
    </main>
  );
}

import { AnimatedRoutes } from '@/app/AnimatedRoutes';

/**
 * Chrome for unauthenticated screens: welcome, sign in, register, check email, reset.
 * Each screen lays itself out with ScreenContainer / FormScreen, so this is only the
 * landmark and the focus target for "skip to content". It is also the boundary Step 4D
 * guards: a route is public or protected by virtue of which layout it sits under.
 */
export function PublicLayout() {
  return (
    <main id="public-main" tabIndex={-1}>
      <AnimatedRoutes />
    </main>
  );
}

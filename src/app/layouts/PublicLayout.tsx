/** Layout for the signed-out screens. */
import { AnimatedRoutes } from '@/app/AnimatedRoutes';

export function PublicLayout() {
  return (
    <main id="public-main" tabIndex={-1}>
      <AnimatedRoutes />
    </main>
  );
}

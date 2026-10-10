import { NotFoundScreen } from '@/app/NotFoundScreen';

/**
 * The `*` route. Deep linking and PWA reloads make this reachable more often
 * than it looks: any URL the router does not match lands here.
 */
export function NotFoundPage() {
  return <NotFoundScreen />;
}

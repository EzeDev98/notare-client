/** The banner under the list title while offline. */
import { InfoBanner } from '@/design-system/ui';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { OFFLINE_COPY } from '@/features/notes/list/offlineContent';

export function ListBanners() {
  const offline = useOffline();
  return offline ? <InfoBanner>{OFFLINE_COPY.banner}</InfoBanner> : null;
}

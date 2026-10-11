import type { NotesView } from '@/app/routes';
import { InfoBanner } from '@/design-system/ui';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { OFFLINE_COPY } from '@/features/notes/list/offlineContent';

/** The banners under the list title: offline, and the Recently deleted notice. */
export function ListBanners({ view }: { view: NotesView }) {
  const offline = useOffline();
  return (
    <>
      {offline ? <InfoBanner>{OFFLINE_COPY.banner}</InfoBanner> : null}
      {view === 'deleted' ? <InfoBanner>{LIST_COPY.deletedBanner}</InfoBanner> : null}
    </>
  );
}

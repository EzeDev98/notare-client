/** Says which version the app is after an update. */
import { useEffect } from 'react';

import { useToast } from '@/design-system/ui';
import { UPDATE_COPY } from '@/pwa/updateContent';
import { consumeUpdateReload } from '@/pwa/updateReload';

export function useUpdatedToast(ready: boolean): void {
  const { toast } = useToast();

  useEffect(() => {
    if (!ready) return;
    if (consumeUpdateReload()) toast(UPDATE_COPY.updated(__APP_VERSION__), { tone: 'success' });
  }, [ready, toast]);
}

import type { ComponentProps } from 'react';

import type { DrawerContent } from '@/design-system/ui';
import { useOffline } from '@/features/notes/hooks/useOffline';

type DrawerSync = ComponentProps<typeof DrawerContent>['sync'];

/**
 * The drawer's one sync line. It never says "synced" while something is
 * waiting or the device is offline: offline wins, then anything waiting
 * counts as syncing, and only an empty queue reads "All notes synced".
 */
export function useDrawerSync(waiting: number): DrawerSync {
  const offline = useOffline();
  if (offline) return { state: 'offline', waiting };
  if (waiting > 0) return { state: 'syncing', waiting };
  return { state: 'online' };
}

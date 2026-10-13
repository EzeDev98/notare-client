import { useToast } from '@/design-system/ui';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { setStorageFull } from '@/features/notes/status/storageFull';
import { formatBytes } from '@/lib/formatBytes';

import { ConfirmModal } from './ConfirmModal';
import { SETTINGS_COPY } from './settingsContent';

const COPY = SETTINGS_COPY.syncStorage;

/**
 * The Free up space dialog: removes voice clips that are already synced from
 * this device. Used by the "This device is full" banner (step 14c). The same
 * steps run on Settings > Sync and storage.
 */
export function FreeUpSpaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();

  const freeUp = async (): Promise<string | undefined> => {
    const freed = await clipRepository.releaseSyncedAudio();
    if (freed > 0) setStorageFull(false);
    toast(COPY.free.done(formatBytes(freed)), { tone: 'success' });
    return undefined;
  };

  return (
    <ConfirmModal
      open={open}
      title={COPY.free.title}
      body={COPY.free.body}
      confirmLabel={COPY.free.confirm}
      onClose={onClose}
      onConfirm={freeUp}
    />
  );
}

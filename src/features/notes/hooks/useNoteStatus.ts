/** Whether a note is saved and synced. */
import { useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { SAVING_LOCAL_MS, SYNCED_AFTER_MS } from '@/core/config/timings';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { deriveNoteStatus, type NoteStatus } from '@/features/notes/status/noteStatus';
import { useStorageFull } from '@/features/notes/status/storageFull';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { isSyncPaused } from '@/sync/syncStatus';
import { useSyncStatus } from '@/sync/useSyncStatus';

export function useNoteStatus(noteId: string | undefined): NoteStatus | null {
  const row = useLiveQuery(async () => {
    if (noteId === undefined || noteId === '') return null;
    return (await noteRepository.getByLocalId(noteId)) ?? null;
  }, [noteId]);

  const online = useOnlineStatus();
  const sync = useSyncStatus();
  const storageFull = useStorageFull();
  const { state: auth } = useAuth();

  const [now, setNow] = useState(() => Date.now());
  const stamp = row?.localUpdatedAt ?? null;
  useEffect(() => {
    if (stamp === null) return;
    setNow(Date.now());

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const after of [SAVING_LOCAL_MS, SYNCED_AFTER_MS]) {
      const wait = stamp + after - Date.now();
      if (wait > 0) {
        timers.push(
          setTimeout(() => {
            setNow(Date.now());
          }, wait + 5),
        );
      }
    }
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [stamp]);

  if (!row) return null;

  return deriveNoteStatus({
    row,
    now,
    online,
    syncFailing: isSyncPaused(sync),
    storageFull,
    signedOut: auth.status === 'session-expired',
  });
}

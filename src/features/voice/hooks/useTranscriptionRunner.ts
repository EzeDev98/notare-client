import { useEffect } from 'react';

import { useToast } from '@/design-system/ui';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import { driveTranscription } from '@/features/voice/transcribe';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

/**
 * While a note is open, sends its queued transcriptions as soon as the device
 * is online and the clip has reached the server, and follows them to the end.
 * Shows "Transcript ready" when one finishes.
 */
export function useTranscriptionRunner(noteId: string, enabled: boolean): void {
  const online = useOnlineStatus();
  const { toast } = useToast();

  const pending = useLiveQuery(async () => {
    const clips = await clipRepository.listForNote(noteId);
    const rows = await Promise.all(clips.map((clip) => transcriptRepository.get(clip.id)));
    const out: { clipId: string; serverId: number }[] = [];
    clips.forEach((clip, index) => {
      const status = rows[index]?.status;
      if (clip.serverId !== null && (status === 'queued' || status === 'transcribing')) {
        out.push({ clipId: clip.id, serverId: clip.serverId });
      }
    });
    return out;
  }, [noteId]);

  useEffect(() => {
    if (!enabled || !online || !pending) return;
    for (const item of pending) {
      void driveTranscription(item.clipId, item.serverId).then((status) => {
        if (status === 'done') toast('Transcript ready');
      });
    }
  }, [enabled, online, pending, toast]);
}

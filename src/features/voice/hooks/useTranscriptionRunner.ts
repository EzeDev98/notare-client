/** Sends an open note's queued transcriptions and follows them to the end. */
import { useEffect } from 'react';

import { useToast } from '@/design-system/ui';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import { driveTranscription } from '@/features/voice/transcribe';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

export function useTranscriptionRunner(noteId: string): void {
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
    if (!online || !pending) return;
    for (const item of pending) {
      void driveTranscription(item.clipId, item.serverId).then((status) => {
        if (status === 'done') toast('Transcript ready');
      });
    }
  }, [online, pending, toast]);
}

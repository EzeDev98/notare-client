import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/design-system/components/Button/Button';
import type { ClipRow } from '@/features/notes/local/clipRow';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { useClips } from '@/features/voice/hooks/useClips';
import { voiceKeys } from '@/features/voice/hooks/useVoiceNotes';
import './LocalClips.css';

const STATE_WORDS: Record<ClipRow['uploadState'], string> = {
  local: 'Saved on this device. Waiting to upload.',
  uploading: 'Uploading...',
  synced: 'Uploaded',
  failed: 'Upload failed.',
};

function ClipAudio({ audio }: { audio: Blob }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(audio);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [audio]);

  return url === null ? null : <audio controls preload="metadata" src={url} />;
}

/**
 * The clips of a note that the server does not have yet (step 8j). Once a clip
 * is uploaded it leaves this list and appears in the note's normal clip list.
 * Replaced by the rebuilt editor in step 12.
 */
export function LocalClips({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const clips = useClips(noteId);

  const syncedCount = clips?.filter((clip) => clip.uploadState === 'synced').length ?? 0;
  const previousSyncedRef = useRef(syncedCount);
  useEffect(() => {
    // A clip just reached the server: refresh the server's list so it shows up.
    if (syncedCount > previousSyncedRef.current) {
      void queryClient.invalidateQueries({ queryKey: voiceKeys.all });
    }
    previousSyncedRef.current = syncedCount;
  }, [syncedCount, queryClient]);

  const waiting = clips?.filter((clip) => clip.uploadState !== 'synced') ?? [];
  if (waiting.length === 0) return null;

  return (
    <ul className="local-clips" aria-label="Clips not uploaded yet">
      {waiting.map((clip) => (
        <li key={clip.id} className="local-clips__item">
          {clip.audio ? <ClipAudio audio={clip.audio} /> : null}
          <span className="local-clips__state">{STATE_WORDS[clip.uploadState]}</span>
          {clip.uploadState === 'failed' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void clipRepository.retry(clip.id);
              }}
            >
              Try again
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

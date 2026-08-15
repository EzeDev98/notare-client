import { useEffect, useState } from 'react';

import { voiceService } from '@/features/voice/api/voiceService';

export type AudioBlobState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' };

/**
 * Fetches a voice note's bytes as an authenticated `Blob` and exposes a
 * `blob:` object URL for `<audio src>` — the fallback path §1.4 sanctions
 * until the service worker (Step 11) can attach `Authorization` to a
 * native ranged `<audio>` request. See `voiceService.downloadVoiceNoteBlob`'s
 * own doc comment for the full reasoning.
 *
 * The object URL is revoked on unmount AND whenever `voiceNoteId` changes
 * — `URL.createObjectURL` leaks memory for as long as the URL lives if
 * nothing calls `revokeObjectURL`, and switching between two voice notes
 * in the same session without this would leak one blob per note played.
 */
export function useAudioBlob(voiceNoteId: number | null): AudioBlobState {
  const [state, setState] = useState<AudioBlobState>({ status: 'loading' });

  useEffect(() => {
    if (voiceNoteId === null) {
      setState({ status: 'loading' });
      return;
    }

    let objectUrl: string | null = null;
    const controller = new AbortController();
    setState({ status: 'loading' });

    voiceService
      .downloadVoiceNoteBlob(voiceNoteId, { signal: controller.signal })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl });
      })
      .catch(() => {
        setState({ status: 'error' });
      });

    return () => {
      controller.abort();
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [voiceNoteId]);

  return state;
}

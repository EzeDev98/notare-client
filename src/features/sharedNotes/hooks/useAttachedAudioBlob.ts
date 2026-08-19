import { useEffect, useState } from 'react';

import { sharedNoteService } from '@/features/sharedNotes/api/sharedNoteService';

export type AudioBlobState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' };

/**
 * A note-attachment's audio, gated by the PARENT NOTE's grant — mirrors
 * `useAudioBlob`/`useSharedAudioBlob`'s object-URL lifecycle exactly, but
 * backed by `/shared-notes/{noteId}/voice-notes/{voiceNoteId}/download`
 * (note-grant-gated) rather than `/voice-notes/{id}/download`
 * (ownership-gated) or `/shared-voice-notes/{id}/download` (VoiceShare-
 * grant-gated) — the third, distinct authorization path
 * `SharedNoteService#getAttachedVoiceNoteAudio` exists for on the server.
 */
export function useAttachedAudioBlob(noteId: number | null, voiceNoteId: number | null): AudioBlobState {
  const [state, setState] = useState<AudioBlobState>({ status: 'loading' });

  useEffect(() => {
    if (noteId === null || voiceNoteId === null) {
      setState({ status: 'loading' });
      return;
    }

    let objectUrl: string | null = null;
    const controller = new AbortController();
    setState({ status: 'loading' });

    sharedNoteService
      .downloadAttachedVoiceNoteBlob(noteId, voiceNoteId, { signal: controller.signal })
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
  }, [noteId, voiceNoteId]);

  return state;
}

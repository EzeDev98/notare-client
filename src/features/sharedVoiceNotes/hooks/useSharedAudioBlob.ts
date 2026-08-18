import { useEffect, useState } from 'react';

import { sharedVoiceNoteService } from '@/features/sharedVoiceNotes/api/sharedVoiceNoteService';

export type SharedAudioBlobState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' };

/**
 * The recipient-side counterpart to `useAudioBlob` — fetches a SHARED voice
 * note's bytes as an authenticated `Blob` via
 * `sharedVoiceNoteService.downloadSharedVoiceNoteBlob` (the grant-gated
 * `/shared-voice-notes/{id}/download` endpoint) rather than
 * `voiceService.downloadVoiceNoteBlob` (owner-only). A SEPARATE hook, not
 * `useAudioBlob` reused with a different service passed in — this
 * codebase's established rule that recipient-facing content never shares
 * an owner-side implementation (`SharedNote.tsx` vs `NoteDetail.tsx`,
 * `SharedVoiceNoteCard.tsx`'s own doc comment on why it duplicates
 * `formatDuration` rather than importing it) applies at the hook level
 * here too, not just the component level.
 *
 * Same object-URL lifecycle as `useAudioBlob`: created on fetch, revoked on
 * unmount AND whenever `voiceNoteId` changes, for the identical
 * leak-prevention reason.
 */
export function useSharedAudioBlob(voiceNoteId: number | null): SharedAudioBlobState {
  const [state, setState] = useState<SharedAudioBlobState>({ status: 'loading' });

  useEffect(() => {
    if (voiceNoteId === null) {
      setState({ status: 'loading' });
      return;
    }

    let objectUrl: string | null = null;
    const controller = new AbortController();
    setState({ status: 'loading' });

    sharedVoiceNoteService
      .downloadSharedVoiceNoteBlob(voiceNoteId, { signal: controller.signal })
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

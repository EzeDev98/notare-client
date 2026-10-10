import { useCallback, useState } from 'react';

import { getDraft, persistDraftIfContent } from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { isQuotaError, setStorageFull } from '@/features/notes/status/storageFull';
import type { VoiceUploadHandle } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';

/**
 * Where a finished recording goes (step 8j): onto THIS DEVICE, first. The
 * sync engine uploads it later, once the note has a server id, so recording
 * works offline and on a note that has never been sent.
 *
 * Shaped like the old upload handle so the recorder does not change. "Success"
 * means safely stored, not uploaded.
 *
 * A clip recorded into a blank draft makes it a real note: the draft counts
 * the clip and is written (a note with a clip is never empty, 8e).
 */
export function useSaveClip(noteId: string | undefined): VoiceUploadHandle {
  const [isPending, setPending] = useState(false);
  const [isError, setError] = useState(false);

  const mutate = useCallback<VoiceUploadHandle['mutate']>(
    (variables, options) => {
      if (noteId === undefined) return;
      setPending(true);
      setError(false);

      void (async () => {
        try {
          const durationMs = (variables.durationSeconds ?? 0) * 1000;
          const clip = await clipRepository.add(
            noteId,
            variables.file,
            durationMs,
            variables.file.type,
          );

          const draft = getDraft(noteId);
          if (draft) {
            draft.clips.push(clip.id);
            await persistDraftIfContent(draft);
          }

          setStorageFull(false);
          options?.onSuccess?.();
        } catch (error) {
          if (isQuotaError(error)) setStorageFull(true);
          setError(true);
        } finally {
          setPending(false);
        }
      })();
    },
    [noteId],
  );

  return { mutate, isPending, isError };
}

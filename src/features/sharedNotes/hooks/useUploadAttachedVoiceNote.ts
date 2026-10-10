import { useMutation, useQueryClient } from '@tanstack/react-query';

import { gateway } from '@/core/adapter';
import { attachedVoiceNotesKeys } from '@/features/sharedNotes/hooks/useAttachedVoiceNotes';

interface UploadVariables {
  file: Blob;
  durationSeconds?: number;
  onProgress?: (fraction: number) => void;
}

/**
 * Record a new voice note directly onto a SHARED note. Requires WRITE —
 * mirrors `useUploadVoiceNote` (the owner's mutation), but posts through
 * `gateway.uploadSharedClip` (`POST /shared-notes/{noteId}/voice-notes`)
 * instead of the owner-only `/voice-notes` endpoint, so the server can run
 * the WRITE-grant check and the courtesy auto-share-back-to-owner (see
 * `SharedNoteServiceImpl#uploadVoiceNote`'s doc comment on the server).
 *
 * `noteId` is fixed per-hook-instance (the note this recorder is mounted
 * on), not a per-call variable — a `VoiceRecorder` only ever records onto
 * the one note it's rendered inside.
 */
export function useUploadAttachedVoiceNote(noteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, durationSeconds, onProgress }: UploadVariables) =>
      gateway.uploadSharedClip(noteId, file, {
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        ...(onProgress !== undefined ? { onProgress } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attachedVoiceNotesKeys.byNote(noteId) });
    },
  });
}

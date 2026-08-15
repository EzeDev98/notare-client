import { useMutation, useQueryClient } from '@tanstack/react-query';

import { voiceService } from '@/features/voice/api/voiceService';
import { voiceKeys } from '@/features/voice/hooks/useVoiceNotes';

interface UploadVariables {
  file: Blob;
  noteId?: number;
  durationSeconds?: number;
  onProgress?: (fraction: number) => void;
}

/**
 * `useMutation`'s own `onProgress` isn't a first-class option (there's no
 * hook for "an upload that reports 0..1 over time"), so the progress
 * callback rides along inside the mutation variables instead — the
 * caller passes it in per-call, same as it would pass any other argument
 * `voiceService.uploadVoiceNote` needs.
 */
export function useUploadVoiceNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, noteId, durationSeconds, onProgress }: UploadVariables) =>
      voiceService.uploadVoiceNote(file, {
        // Conditionally spread, not passed straight through — this repo's
        // tsconfig has exactOptionalPropertyTypes on, so an object literal
        // with `noteId: undefined` does not satisfy a target typed
        // `noteId?: number` (that means "omit the key, or give a real
        // number" — never an explicit undefined). Same pattern every
        // other optional-signal call in this codebase already uses
        // (voiceService.ts's own `...(signal ? { signal } : {})`).
        ...(noteId !== undefined ? { noteId } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        ...(onProgress !== undefined ? { onProgress } : {}),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: voiceKeys.all });
      if (created.noteId !== null) {
        void queryClient.invalidateQueries({ queryKey: voiceKeys.byNote(created.noteId) });
      }
    },
  });
}

export function useDeleteVoiceNote(noteId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => voiceService.deleteVoiceNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: voiceKeys.all });
      if (noteId !== null) {
        void queryClient.invalidateQueries({ queryKey: voiceKeys.byNote(noteId) });
      }
    },
  });
}

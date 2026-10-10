import { useQuery } from '@tanstack/react-query';

import { gateway } from '@/core/adapter';

export const attachedVoiceNotesKeys = {
  all: ['shared-notes', 'attached-voice-notes'] as const,
  byNote: (noteId: number) => [...attachedVoiceNotesKeys.all, noteId] as const,
};

/**
 * Every voice note attached to a shared note, regardless of which
 * collaborator recorded it. `GET /shared-notes/{noteId}/voice-notes`.
 *
 * Requires at least READ on the note — same grant that unlocks the note
 * itself, so this only ever gets called once `SharedNotePage` already has a
 * note to show (mirrors `useVoiceNotesByNote`'s `enabled` pattern).
 */
export function useAttachedVoiceNotes(noteId: number | null) {
  return useQuery({
    queryKey: attachedVoiceNotesKeys.byNote(noteId ?? -1),
    queryFn: ({ signal }) => gateway.listSharedClips(noteId as number, { signal }),
    enabled: noteId !== null,
  });
}

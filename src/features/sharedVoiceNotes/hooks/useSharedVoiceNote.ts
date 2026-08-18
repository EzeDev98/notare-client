import { useQuery } from '@tanstack/react-query';

import { sharedVoiceNoteService } from '@/features/sharedVoiceNotes/api/sharedVoiceNoteService';
import { sharedVoiceNotesKeys } from '@/features/sharedVoiceNotes/hooks/useSharedVoiceNotes';
import { isNotFound } from '@/lib/http/errors';

/**
 * A single shared voice note — the player's read model at
 * `/shared-voice/:id`. Mirrors `useSharedNote` exactly, including
 * `retry: false` for the identical reason: a 404 here means "no grant"
 * (NOTARE-SERVER.md §3.2), and retrying that never changes the answer, only
 * delays the permission-denied state the caller needs to show.
 *
 * Unlike `useSharedNote`, this response already carries `permission`
 * directly — no separate `useSharedNotePermission`-style cache lookup is
 * needed alongside it.
 */
export function useSharedVoiceNote(voiceNoteId: number) {
  return useQuery({
    queryKey: sharedVoiceNotesKeys.detail(voiceNoteId),
    queryFn: ({ signal }) => sharedVoiceNoteService.getSharedVoiceNote(voiceNoteId, { signal }),
    retry: false,
  });
}

/** Same "no grant at all" check as `isNoGrantError` on the note side. */
export function isNoGrantError(error: unknown): boolean {
  return isNotFound(error);
}

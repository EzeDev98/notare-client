import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { voiceService } from '@/features/voice/api/voiceService';

export const voiceKeys = {
  all: ['voice-notes'] as const,
  list: (page: number) => [...voiceKeys.all, 'list', page] as const,
  byNote: (noteId: number) => [...voiceKeys.all, 'by-note', noteId] as const,
  detail: (id: number) => [...voiceKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 20;

/** The `/voice` list — every voice note across all notes. */
export function useVoiceNotes(page: number) {
  return useQuery({
    queryKey: voiceKeys.list(page),
    queryFn: ({ signal }) => voiceService.listVoiceNotes(page, PAGE_SIZE, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Voice notes linked to ONE note — unpaged (`listVoiceNotesByNote`'s own
 * doc comment: §13 names this "list, unpaged"), since a single note
 * realistically holds a handful of recordings, not pages of them.
 *
 * `enabled: noteId !== null` — a note with no `serverId` yet (never
 * synced) cannot have any linked voice notes, since the link is
 * server-side (`VoiceNote.noteId`).
 */
export function useVoiceNotesByNote(noteId: number | null) {
  return useQuery({
    queryKey: voiceKeys.byNote(noteId ?? -1),
    queryFn: ({ signal }) => voiceService.listVoiceNotesByNote(noteId as number, { signal }),
    enabled: noteId !== null,
  });
}

export function useVoiceNote(id: number) {
  return useQuery({
    queryKey: voiceKeys.detail(id),
    queryFn: ({ signal }) => voiceService.getVoiceNote(id, { signal }),
  });
}

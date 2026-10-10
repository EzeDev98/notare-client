import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { gateway } from '@/core/adapter';

export const voiceKeys = {
  all: ['voice-notes'] as const,
  list: (page: number) => [...voiceKeys.all, 'list', page] as const,
  byNote: (noteId: number) => [...voiceKeys.all, 'by-note', noteId] as const,
  detail: (id: number) => [...voiceKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 8;

/** The `/voice` list — every voice note across all notes. */
export function useVoiceNotes(page: number) {
  return useQuery({
    queryKey: voiceKeys.list(page),
    queryFn: ({ signal }) => gateway.listClips(page, PAGE_SIZE, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Voice notes linked to ONE note — unpaged (`listVoiceNotesByNote`'s own
 * doc comment: §13 names this "list, unpaged"), since a single note
 * realistically holds a handful of recordings, not pages of them.
 *
 * NOT `placeholderData: keepPreviousData`, deliberately — that was tried
 * and made things worse, not better. `keepPreviousData` keeps serving the
 * LAST SUCCESSFUL response as a placeholder whenever the query key
 * changes, with no awareness of *which* key it belonged to. For
 * `useVoiceNotes`'s pagination above that's correct (page 2's placeholder
 * being page 1's data is the intended UX). Here the key is a `noteId`, so
 * switching from a note WITH recordings to one WITHOUT any served the
 * outgoing note's recordings as the placeholder for the incoming note —
 * the inline block would render the wrong note's audio players for a
 * frame, then swap to empty once the real response landed. That is worse
 * than the plain undefined-then-populated flash it was meant to fix: it
 * is two shifts instead of one, PLUS briefly wrong content.
 *
 * The placeholder below is scoped to same-note transitions only: it
 * reuses the previous data solely when the previous query's own key
 * matches the CURRENT noteId (i.e. this is a refetch of the note you're
 * already looking at — a revalidation, not a note switch). On an actual
 * note switch it falls through to `undefined`, exactly like an ordinary
 * first load, which is the correct, honest state for content that
 * belongs to a different note than what's on screen.
 *
 * `enabled: noteId !== null` — a note with no `serverId` yet (never
 * synced) cannot have any linked voice notes, since the link is
 * server-side (`VoiceNote.noteId`).
 */
export function useVoiceNotesByNote(noteId: number | null) {
  return useQuery({
    queryKey: voiceKeys.byNote(noteId ?? -1),
    queryFn: ({ signal }) => gateway.listClipsByNote(noteId as number, { signal }),
    enabled: noteId !== null,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === (noteId ?? -1) ? previousData : undefined,
  });
}

export function useVoiceNote(id: number) {
  return useQuery({
    queryKey: voiceKeys.detail(id),
    queryFn: ({ signal }) => gateway.getClip(id, { signal }),
    placeholderData: keepPreviousData,
  });
}

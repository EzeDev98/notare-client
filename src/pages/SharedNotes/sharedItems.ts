import { useMemo } from 'react';

import { useSharedNotes } from '@/features/sharedNotes/hooks/useSharedNotes';
import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';
import { useSharedVoiceNotes } from '@/features/sharedVoiceNotes/hooks/useSharedVoiceNotes';
import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';
import { parseServerDateTime } from '@/lib/time';

/**
 * The unified "Shared with me" list.
 *
 * The page is intentionally note-centric:
 *
 *   Shared text note
 *      ├── attached voice notes
 *      ├── attached voice notes
 *      └── attached voice notes
 *
 *   Standalone shared voice note
 *
 * A voice note whose `noteId` points at a note that is also present in the
 * shared-notes collection is NOT rendered as another top-level row. The
 * parent note owns that content.
 *
 * A voice note whose `noteId` is null remains a top-level item because it has
 * no parent note/container available to represent it.
 *
 * We also keep the existing two server collections separate underneath this
 * page. The page needs their individual query state so one failing collection
 * does not erase rows successfully loaded from the other.
 */

export interface SharedNoteItem {
  type: 'note';
  sharedAt: string;
  note: SharedNoteSummaryResponse;
}

export interface SharedStandaloneVoiceItem {
  type: 'standalone-voice';
  sharedAt: string;
  voiceNote: SharedVoiceNoteSummaryResponse;
}

export type SharedItem = SharedNoteItem | SharedStandaloneVoiceItem;

function toTimestamp(value: string): number {
  const parsed = parseServerDateTime(value);
  return parsed ? parsed.getTime() : 0;
}

/**
 * Combines the two recipient-side collections into the single note-centric
 * list used by `/shared`.
 *
 * Attached voice notes are suppressed when their parent note is present in
 * the shared-notes collection.
 *
 * Standalone voice notes (`noteId === null`) remain visible as their own
 * note-like item.
 *
 * A voice note with a non-null `noteId` whose parent note is NOT present in
 * the shared-notes collection also remains visible. In that situation the
 * recipient has access to the voice share but does not have a shared parent
 * note to display it under.
 *
 * Pagination remains based on the two existing server collections. This is
 * deliberately kept within the current implementation boundary rather than
 * introducing a new backend endpoint or inventing a merged cursor.
 */
export function useSharedItems(page: number, size: number) {
  const notesQuery = useSharedNotes(page, size);
  const voiceQuery = useSharedVoiceNotes(page, size);

  const items = useMemo<SharedItem[]>(() => {
    const notes = notesQuery.data?.content ?? [];
    const voiceNotes = voiceQuery.data?.content ?? [];

    const sharedNoteIds = new Set(notes.map((shared) => shared.note.id));

    const noteItems: SharedItem[] = notes.map((note) => ({
      type: 'note',
      sharedAt: note.sharedAt,
      note,
    }));

    const standaloneVoiceItems: SharedItem[] = voiceNotes
      .filter(
        (voiceNote) =>
          voiceNote.noteId === null || !sharedNoteIds.has(voiceNote.noteId),
      )
      .map((voiceNote) => ({
        type: 'standalone-voice',
        sharedAt: voiceNote.sharedAt,
        voiceNote,
      }));

    return [...noteItems, ...standaloneVoiceItems].sort(
      (a, b) => toTimestamp(b.sharedAt) - toTimestamp(a.sharedAt),
    );
  }, [notesQuery.data, voiceQuery.data]);

  return {
    items,
    notesQuery,
    voiceQuery,
  };
}

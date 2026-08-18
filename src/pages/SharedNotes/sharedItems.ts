import { useMemo } from 'react';

import { useSharedNotes } from '@/features/sharedNotes/hooks/useSharedNotes';
import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';
import { useSharedVoiceNotes } from '@/features/sharedVoiceNotes/hooks/useSharedVoiceNotes';
import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';
import { parseServerDateTime } from '@/lib/time';

/**
 * The "All" tab's client-side merge of two independent server collections —
 * `GET /shared-notes` and `GET /shared-voice-notes`. Neither wire type is
 * touched: each row is wrapped in a small discriminated union rather than
 * the two DTOs being reshaped to match each other, so `SharedNoteSummaryResponse`
 * and `SharedVoiceNoteSummaryResponse` stay exactly what their respective
 * services return.
 *
 * PAGE-COLOCATED rather than a `features/` module: this normalization is
 * specific to what the "Shared with me" page's All tab needs to render, not
 * a shape either `sharedNotes` or `sharedVoiceNotes` has any reason to know
 * about — mirrors this codebase's existing rule that page-specific glue
 * doesn't get promoted into a feature module just because it touches two of
 * them.
 */

export interface SharedNoteItem {
  type: 'note';
  sharedAt: string;
  note: SharedNoteSummaryResponse;
}

export interface SharedVoiceItem {
  type: 'voice';
  sharedAt: string;
  voiceNote: SharedVoiceNoteSummaryResponse;
}

export type SharedItem = SharedNoteItem | SharedVoiceItem;

/**
 * `sharedAt` is a zoneless `LocalDateTime` on BOTH DTOs (`lib/time.ts`'s own
 * doc comment: "everything else: notes, shares, notifications"). Sorting by
 * `new Date(value).getTime()` directly would be silently wrong by the
 * server's offset for any user not in its timezone — the exact bug
 * `parseServerDateTime` exists to prevent. An unparseable value sorts as
 * epoch 0 (oldest) rather than throwing or being dropped: a single bad
 * timestamp should sink one row to the bottom of the list, not break the
 * merge for every other row in it.
 */
function toTimestamp(value: string): number {
  const parsed = parseServerDateTime(value);
  return parsed ? parsed.getTime() : 0;
}

/**
 * Combines the current page of `useSharedNotes` and `useSharedVoiceNotes`
 * into one `sharedAt`-descending list.
 *
 * KNOWN SIMPLIFICATION, flagged rather than silently accepted: both queries
 * share the SAME `page`/`size` — there is no true merged cursor across two
 * independently-paginated server collections. "Next" therefore advances
 * both sources in lockstep rather than computing a globally-correct next 20
 * items across both types combined. Consistent in spirit with the note
 * side's own pre-existing, documented `totalElements`-overcount limitation
 * (`useSharedNotes.ts`) — an accepted trade-off of this step, not something
 * this merge is expected to solve unprompted.
 *
 * Returns the two underlying queries alongside `items` (not just a single
 * combined `isLoading`/`isError`) — 10e (independent failure handling) needs
 * to tell them apart: one collection failing must not blank out the other's
 * successfully-loaded rows.
 */
export function useSharedItems(page: number, size: number) {
  const notesQuery = useSharedNotes(page, size);
  const voiceQuery = useSharedVoiceNotes(page, size);

  const items = useMemo<SharedItem[]>(() => {
    const noteItems: SharedItem[] = (notesQuery.data?.content ?? []).map((note) => ({
      type: 'note',
      sharedAt: note.sharedAt,
      note,
    }));
    const voiceItems: SharedItem[] = (voiceQuery.data?.content ?? []).map((voiceNote) => ({
      type: 'voice',
      sharedAt: voiceNote.sharedAt,
      voiceNote,
    }));

    return [...noteItems, ...voiceItems].sort(
      (a, b) => toTimestamp(b.sharedAt) - toTimestamp(a.sharedAt),
    );
  }, [notesQuery.data, voiceQuery.data]);

  return { items, notesQuery, voiceQuery };
}

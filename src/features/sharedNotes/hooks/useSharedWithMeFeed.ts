
import { useMemo } from 'react';

import { useSharedNotes } from '@/features/sharedNotes/hooks/useSharedNotes';

import { useSharedVoiceNotes } from '@/features/sharedVoiceNotes/hooks/useSharedVoiceNotes';

import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';

import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';

export type SharedFeedItem =

  | { kind: 'note'; sharedAt: string; data: SharedNoteSummaryResponse }

  | { kind: 'voice'; sharedAt: string; data: SharedVoiceNoteSummaryResponse };

/**

 * Merges `/shared-notes` and standalone `/shared-voice-notes` into ONE feed,

 * per the brief: no All/Notes/Voice split, "the page is simply a collection

 * of shared notes" where a standalone voice share renders as a note-like

 * item too.

 *

 * FILTERS voice shares to `noteId === null` — a voice note attached to a

 * note must not create a second list item; it's expected to be visible

 * inside that note's own card/detail page instead (`SharedNote` rendering

 * its attachments, a separate piece of work).

 *

 * PAGINATION NOTE: each underlying list is fetched with its own `page`/`size`

 * and the two are merged and re-sorted client-side. This means "page 2" of

 * the merged feed is not a clean continuation of two independent server-side

 * pages once either list's cursor drifts — acceptable for now (both lists

 * are typically short), flagged here rather than quietly assumed correct at

 * scale. A server endpoint that returns both kinds pre-merged would be the

 * real fix if this list ever needs to paginate deeply.

 */

export function useSharedWithMeFeed(page = 0, size = 20) {

  const notes = useSharedNotes(page, size);

  const voice = useSharedVoiceNotes(page, size);

  const items = useMemo<SharedFeedItem[]>(() => {

    const noteItems: SharedFeedItem[] =

      notes.data?.content.map((data) => ({ kind: 'note' as const, sharedAt: data.sharedAt, data })) ??

      [];

    const voiceItems: SharedFeedItem[] =

      voice.data?.content

        .filter((data) => data.noteId === null)

        .map((data) => ({ kind: 'voice' as const, sharedAt: data.sharedAt, data })) ?? [];

    return [...noteItems, ...voiceItems].sort(

      (a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime(),

    );

  }, [notes.data, voice.data]);

  return {

    items,

    hasMoreNotes: (notes.data?.content.length ?? 0) >= size,

    hasMoreVoice: (voice.data?.content.length ?? 0) >= size,

    isLoading: notes.isLoading || voice.isLoading,

    isError: notes.isError && voice.isError,

    isPartialError: notes.isError !== voice.isError,

    isFetching: notes.isFetching || voice.isFetching,

    refetch: () => {

      void notes.refetch();

      void voice.refetch();

    },

  };

}


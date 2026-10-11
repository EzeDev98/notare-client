import type { NotesView } from '@/app/routes';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { sharedRepository } from '@/features/notes/local/sharedRepository';
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import { daysLeft } from '@/features/notes/local/trashRules';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

import { fromNoteRow, fromSharedRow, type ListItem } from './listItem';

function rowsFor(view: Exclude<NotesView, 'shared'>, ownerId: number) {
  switch (view) {
    case 'archived':
      return noteQueries.listArchived(ownerId);
    case 'deleted':
      return noteQueries.listTrashed(ownerId);
    case 'all':
      return noteQueries.listActive(ownerId);
  }
}

const has = (text: string, needle: string): boolean => text.toLowerCase().includes(needle);

/** One view, optionally narrowed by a search term that matches the text or a transcript. */
async function read(view: NotesView, ownerId: number, term: string): Promise<ListItem[]> {
  const needle = term.trim().toLowerCase();

  if (view === 'shared') {
    const rows = await sharedRepository.list();
    return rows.filter((row) => needle === '' || has(row.content, needle)).map(fromSharedRow);
  }

  const [rows, clips, transcripts] = await Promise.all([
    rowsFor(view, ownerId),
    clipRepository.countsByNote(),
    needle === '' ? Promise.resolve(new Map<string, string>()) : transcriptRepository.textsByNote(),
  ]);
  const now = Date.now();
  const items: ListItem[] = [];
  for (const row of rows) {
    const inText = needle === '' || has(row.content, needle);
    const inTranscript = needle !== '' && has(transcripts.get(row.localId) ?? '', needle);
    if (!inText && !inTranscript) continue;
    items.push(
      fromNoteRow(
        row,
        clips[row.localId] ?? 0,
        view === 'deleted' ? daysLeft(row, now) : null,
        !inText && inTranscript,
      ),
    );
  }
  return items;
}

/**
 * The rows of one view, read from Dexie only (M-5), narrowed by `term` when
 * there is one. Undefined until Dexie first answers, which is not the same as
 * empty. A refresh that changes nothing hands back the same array.
 */
export function useNoteList(view: NotesView, ownerId: number, term: string): ListItem[] | undefined {
  return useStableLiveQuery(() => read(view, ownerId, term), [view, ownerId, term]);
}

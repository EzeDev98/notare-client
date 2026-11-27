import { clipRepository } from '@/features/notes/local/clipRepository';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

import { fromNoteRow, type ListItem } from './listItem';

const has = (text: string, needle: string): boolean => text.toLowerCase().includes(needle);

/** The notes, optionally narrowed by a search term that matches the text or a transcript. */
async function read(ownerId: number, term: string): Promise<ListItem[]> {
  const needle = term.trim().toLowerCase();

  const [rows, clips, transcripts] = await Promise.all([
    noteQueries.listActive(ownerId),
    clipRepository.countsByNote(),
    needle === '' ? Promise.resolve(new Map<string, string>()) : transcriptRepository.textsByNote(),
  ]);
  const items: ListItem[] = [];
  for (const row of rows) {
    const inText = needle === '' || has(row.content, needle);
    const inTranscript = needle !== '' && has(transcripts.get(row.localId) ?? '', needle);
    if (!inText && !inTranscript) continue;
    items.push(fromNoteRow(row, clips[row.localId] ?? 0, !inText && inTranscript));
  }
  return items;
}

/**
 * The rows, read from Dexie only (M-5), narrowed by `term` when
 * there is one. Undefined until Dexie first answers, which is not the same as
 * empty. A refresh that changes nothing hands back the same array.
 */
export function useNoteList(ownerId: number, term: string): ListItem[] | undefined {
  return useStableLiveQuery(() => read(ownerId, term), [ownerId, term]);
}

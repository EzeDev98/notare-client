/** The notes for the list, optionally filtered by a search term. */
import { clipRepository } from '@/features/notes/local/clipRepository';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

import { fromNoteRow, type ListItem } from './listItem';

const has = (text: string, needle: string): boolean => text.toLowerCase().includes(needle);

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

export function useNoteList(ownerId: number, term: string): ListItem[] | undefined {
  return useStableLiveQuery(() => read(ownerId, term), [ownerId, term]);
}

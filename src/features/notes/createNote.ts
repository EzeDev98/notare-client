/** Creates notes, starting as an in-memory draft. */
import { clipRepository } from '@/features/notes/local/clipRepository';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteCommands } from '@/features/notes/local/noteCommands';
import { createLocalNote } from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { outboxRepository } from '@/features/notes/local/outboxRepository';

export interface Draft {
  id: string;
  content: string;
  clips: string[];
}

interface OpenDraft {
  draft: Draft;
  ownerId: number | null;
  row: NoteRow;
}

const openDrafts = new Map<string, OpenDraft>();

const inFlight = new Map<string, Promise<NoteRow | null>>();

export function startDraft(ownerId: number | null = null): Draft {
  const draft: Draft = { id: crypto.randomUUID(), content: '', clips: [] };
  const row: NoteRow = {
    ...createLocalNote(ownerId, { id: draft.id }),
    dirty: 0,
    syncState: 'pending',
  };
  openDrafts.set(draft.id, { draft, ownerId, row });
  return draft;
}

export function getDraft(id: string): Draft | undefined {
  return openDrafts.get(id)?.draft;
}

export function draftRow(id: string): NoteRow | null {
  return openDrafts.get(id)?.row ?? null;
}

export function hasDraftContent(draft: Draft): boolean {
  return !isEmptyNote({ content: draft.content, clipCount: draft.clips.length });
}

export function findBlankDraft(): Draft | undefined {
  for (const { draft } of openDrafts.values()) {
    if (!hasDraftContent(draft)) return draft;
  }
  return undefined;
}

export function discardDraft(id: string): void {
  const open = openDrafts.get(id);
  if (!open || inFlight.has(id) || hasDraftContent(open.draft)) return;
  openDrafts.delete(id);
}

export function persistDraftIfContent(draft: Draft): Promise<NoteRow | null> {
  const running = inFlight.get(draft.id);
  if (running) return running;

  const open = openDrafts.get(draft.id);
  if (!open || !hasDraftContent(draft)) return Promise.resolve(null);

  const row = createLocalNote(open.ownerId, { id: draft.id, content: draft.content });

  const job = (async (): Promise<NoteRow> => {
    await noteCommands.put(row);
    await outboxRepository.enqueueCreate({
      localId: row.localId,
      clientId: row.clientId,
      content: row.content,
    });
    openDrafts.delete(draft.id);
    return row;
  })().finally(() => {
    inFlight.delete(draft.id);
  });

  inFlight.set(draft.id, job);
  return job;
}

export function createNoteWithContent(
  ownerId: number | null,
  content: string,
): Promise<NoteRow | null> {
  const draft = startDraft(ownerId);
  draft.content = content;
  return persistDraftIfContent(draft);
}

export async function duplicateNote(
  ownerId: number | null,
  sourceNoteId: string,
  content: string,
): Promise<NoteRow | null> {
  const draft = startDraft(ownerId);
  draft.content = content;
  draft.clips = await clipRepository.copyForNote(sourceNoteId, draft.id);
  return persistDraftIfContent(draft);
}

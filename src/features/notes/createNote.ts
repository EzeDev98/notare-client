import { clipRepository } from '@/features/notes/local/clipRepository';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteCommands } from '@/features/notes/local/noteCommands';
import { createLocalNote } from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { outboxRepository } from '@/features/notes/local/outboxRepository';

/**
 * The one place a note is created (step 8d, D-01, D-03, D-04).
 *
 * A new note starts as a DRAFT held in memory. Nothing is written to Dexie and
 * nothing is sent until the draft has a non-blank character or a clip. A draft
 * that is left blank is forgotten: no row, no outbox entry, no toast, no timer.
 *
 * Until the screens are rebuilt (steps 11 and 12) the old creation points call
 * these functions instead of writing rows themselves.
 */
export interface Draft {
  id: string;
  content: string;
  /** Ids of clips recorded into this draft. Filled by step 8j. */
  clips: string[];
}

interface OpenDraft {
  draft: Draft;
  ownerId: number | null;
  /** What the editor shows while the draft is not on disk. Built once, so it is stable. */
  row: NoteRow;
}

const openDrafts = new Map<string, OpenDraft>();

/**
 * Drafts being written right now. Set BEFORE the first await, so two rapid
 * taps (or a keystroke arriving mid-write) share one write and cannot create
 * two rows.
 */
const inFlight = new Map<string, Promise<NoteRow | null>>();

/** A new empty draft. Memory only. */
export function startDraft(ownerId: number | null = null): Draft {
  const draft: Draft = { id: crypto.randomUUID(), content: '', clips: [] };
  const row: NoteRow = {
    ...createLocalNote(ownerId, { id: draft.id }),
    dirty: 0,
    // Not on disk and not on the server: never 'synced' (step 8g).
    syncState: 'pending',
  };
  openDrafts.set(draft.id, { draft, ownerId, row });
  return draft;
}

/** The draft with this id, while it is still only in memory. */
export function getDraft(id: string): Draft | undefined {
  return openDrafts.get(id)?.draft;
}

/** The row to show for a draft that is not on disk yet. */
export function draftRow(id: string): NoteRow | null {
  return openDrafts.get(id)?.row ?? null;
}

export function hasDraftContent(draft: Draft): boolean {
  return !isEmptyNote({ content: draft.content, clipCount: draft.clips.length });
}

/** An open draft that is still blank. The New note button reuses it. */
export function findBlankDraft(): Draft | undefined {
  for (const { draft } of openDrafts.values()) {
    if (!hasDraftContent(draft)) return draft;
  }
  return undefined;
}

/** Forgets a blank draft. A draft with content, or one being written, is left alone. */
export function discardDraft(id: string): void {
  const open = openDrafts.get(id);
  if (!open || inFlight.has(id) || hasDraftContent(open.draft)) return;
  openDrafts.delete(id);
}

/**
 * Writes the draft the first time it has content: the row (dirty, pending)
 * and ONE CREATE in the outbox. Returns the row, or null when the
 * draft is still blank (or was already written).
 */
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

/** A note that starts with text already in it (Duplicate). Null if the text is blank. */
export function createNoteWithContent(
  ownerId: number | null,
  content: string,
): Promise<NoteRow | null> {
  const draft = startDraft(ownerId);
  draft.content = content;
  return persistDraftIfContent(draft);
}

/**
 * Make a copy (step 8j): a new note with the same text and a copy of every
 * clip whose audio is still on this device. The copy is a new note with a new
 * id, so nothing is shared with the original. Null if there is nothing to copy.
 */
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

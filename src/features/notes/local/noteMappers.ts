import type { NoteRow } from '@/features/notes/local/noteRow';
import type { NoteResponse, NoteSummaryResponse } from '@/features/notes/types';

/**
 * The single translation point between wire types and row types.
 *
 * Everything the server does not know about — localId, clientId, dirty,
 * syncState, localUpdatedAt — is added here and stripped here. One file, so
 * the question "does the server know about this field?" has one answer.
 */

/**
 * crypto.randomUUID: built in, cryptographically random, no dependency.
 *
 * Requires a secure context (https or localhost), which the app requires
 * anyway — a PWA cannot register a service worker without one.
 */
/**
 * Encodes a flag for storage.
 *
 * IndexedDB cannot index booleans, so every flag in an index is stored as
 * 0 | 1. Named rather than inlining `? 1 : 0` everywhere, so the reason lives
 * in one place and the call sites read as intent.
 */
export function flag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function newLocalId(): string {
  return crypto.randomUUID();
}

/** Builds a row for a note that exists only locally. */
export function createLocalNote(
  ownerId: number | null,
  fields: { title?: string; content?: string } = {},
): NoteRow {
  const localId = newLocalId();

  return {
    localId,
    serverId: null,
    /*
     * clientId equals localId on creation, and they are still separate
     * fields.
     *
     * localId is OUR key and could in principle be reassigned; clientId is a
     * value we hand to the server and it echoes back forever. Collapsing them
     * would tie a local storage decision to a wire contract.
     */
    clientId: localId,
    title: fields.title ?? '',
    content: fields.content ?? '',
    pinned: 0,
    archived: 0,
    deleted: 0,
    version: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ownerId,
    lastModifiedBy: null,
    dirty: 1,
    syncState: 'pending',
    localUpdatedAt: Date.now(),
  };
}

/**
 * Applies a server response to a row.
 *
 * `existing` is passed so an update preserves localId and clientId — a note
 * that came back from the server is the SAME note, not a new one, and
 * replacing its local identity would orphan every reference to it (the open
 * editor, Step 8's queued operations).
 *
 * Marks the row clean, because by definition the server now holds this. A
 * caller that has newer local edits must not use this — see 7F.
 */
export function fromNoteResponse(note: NoteResponse, existing?: NoteRow): NoteRow {
  return {
    localId: existing?.localId ?? newLocalId(),
    serverId: note.id,
    clientId: existing?.clientId ?? newLocalId(),
    title: note.title ?? '',
    content: note.content ?? '',
    pinned: flag(note.pinned),
    archived: flag(note.archived),
    deleted: 0,
    version: note.version,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: null,
    ownerId: note.ownerId,
    lastModifiedBy: note.lastModifiedBy,
    dirty: 0,
    syncState: 'synced',
    localUpdatedAt: Date.now(),
  };
}

/**
 * A summary carries no content, so an existing row's content is KEPT.
 *
 * Overwriting it with '' would empty every note the moment a list load
 * touched it — a data-loss bug that looks like the list working perfectly.
 */
export function fromNoteSummary(summary: NoteSummaryResponse, existing?: NoteRow): NoteRow {
  return {
    localId: existing?.localId ?? newLocalId(),
    serverId: summary.id,
    clientId: existing?.clientId ?? newLocalId(),
    title: summary.title ?? '',
    content: existing?.content ?? '',
    pinned: flag(summary.pinned),
    archived: flag(summary.archived),
    deleted: 0,
    version: summary.version,
    createdAt: existing?.createdAt ?? null,
    updatedAt: summary.updatedAt,
    deletedAt: null,
    ownerId: existing?.ownerId ?? null,
    lastModifiedBy: existing?.lastModifiedBy ?? null,
    dirty: existing?.dirty ?? 0,
    syncState: existing?.syncState ?? 'synced',
    localUpdatedAt: Date.now(),
  };
}

/**
 * A row as the UI wants to read it.
 *
 * Deliberately NOT NoteResponse — the id may be null, which NoteResponse's
 * type forbids and which is a real state for an offline-created note. Callers
 * route by localId and treat serverId as an implementation detail.
 */
export interface NoteView {
  localId: string;
  serverId: number | null;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  version: number | null;
  updatedAt: string | null;
  /** True when there are local edits the server has not accepted. */
  unsaved: boolean;
}

/**
 * A server summary rendered as a NoteView, WITHOUT a local row.
 *
 * This exists only for search, which is still server-only, and it is the
 * seam where that shows. The `localId` is synthetic — there is no row in
 * Dexie behind it — so it is safe as a React key and as nothing else. Nothing
 * may write to it, which is why search results are rendered without actions.
 *
 * 7G removes this function by settling whether search reads locally. Until
 * then it is better to have the compromise named and contained in one place
 * than spread through the search page as casts.
 */
export function viewFromSummary(summary: NoteSummaryResponse): NoteView {
  return {
    localId: `server-${String(summary.id)}`,
    serverId: summary.id,
    title: summary.title ?? '',
    // Summaries carry no content, and the card renders a preview from it.
    content: '',
    pinned: summary.pinned,
    archived: summary.archived,
    version: summary.version,
    updatedAt: summary.updatedAt,
    // A server result is by definition what the server holds.
    unsaved: false,
  };
}

export function toView(row: NoteRow): NoteView {
  return {
    localId: row.localId,
    serverId: row.serverId,
    title: row.title,
    content: row.content,
    /*
     * Decoded back to booleans HERE, and only here. 0 | 1 is a storage
     * encoding forced by IndexedDB; a component rendering a note should never
     * have to know that, and `pinned === 1` in JSX would be the encoding
     * leaking into the view.
     */
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    version: row.version,
    updatedAt: row.updatedAt,
    unsaved: row.dirty === 1,
  };
}

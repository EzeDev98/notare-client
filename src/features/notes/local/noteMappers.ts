import type { NoteRow } from '@/features/notes/local/noteRow';
import type {
  NoteResponse,
  NoteSummaryResponse,
  TrashedNoteResponse,
} from '@/features/notes/types';

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
  fields: { content?: string } = {},
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
 * True when writing `next` over `existing` would change nothing. Lets a
 * refresh skip a no-op IndexedDB write, which would otherwise fire every
 * useLiveQuery on the notes table and re-render the open note and sidebar.
 */
export function isSameRow(existing: NoteRow, next: NoteRow): boolean {
  return (Object.keys(next) as (keyof NoteRow)[]).every((key) => existing[key] === next[key]);
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
    localUpdatedAt: existing?.localUpdatedAt ?? Date.now(),
    // Preserve the existing local ordering when a note is merely read/refreshed.
    // Opening a note is not a local mutation and must not move it to the top.
    // A genuinely new note still receives Date.now().
  };
}

/**
 * A summary carries no content, so an existing row's content is KEPT.
 *
 * Overwriting it with '' would empty every note the moment a list load
 * touched it — a data-loss bug that looks like the list working perfectly.
 */
export function fromNoteSummary(
  summary: NoteSummaryResponse,
  ownerId: number | null,
  existing?: NoteRow,
): NoteRow {
  return {
    localId: existing?.localId ?? newLocalId(),
    serverId: summary.id,
    clientId: existing?.clientId ?? newLocalId(),
    content: existing?.content ?? '',
    pinned: flag(summary.pinned),
    archived: flag(summary.archived),
    deleted: 0,
    version: summary.version,
    createdAt: existing?.createdAt ?? null,
    updatedAt: summary.updatedAt,
    deletedAt: null,
    /*
     * THE OWNER COMES FROM THE CALLER, not from the summary — NoteSummaryResponse
     * has no ownerId field, and the previous `existing?.ownerId ?? null` was a
     * defect (7E): on a device with an empty database every row inserted by a
     * list refresh got ownerId null, and listActive(ownerId) — which queries the
     * [ownerId+deleted+archived] index — could never match it. A successful
     * fetch, rows in Dexie, and a permanently empty screen.
     *
     * The caller does know: it asked the server for THIS user's notes, so the
     * response is scoped by definition. Passing it makes that scoping explicit
     * instead of hoping a row already existed.
     */
    ownerId: existing?.ownerId ?? ownerId,
    lastModifiedBy: existing?.lastModifiedBy ?? null,
    dirty: existing?.dirty ?? 0,
    syncState: existing?.syncState ?? 'synced',
    // A refresh/open is not a local edit. Preserve the existing ordering
    // timestamp so reading a note does not move it to the top of the list.
    // Only a genuinely new local row gets a fresh timestamp here.
    localUpdatedAt: existing?.localUpdatedAt ?? Date.now(),
  };
}

/**
 * A trashed note from GET /notes/trash.
 *
 * Built ON TOP of fromNoteSummary rather than beside it, because a trashed note
 * IS a summary — plus two facts the summary cannot carry. Duplicating the
 * fifteen fields would mean the next change to a note's local shape has two
 * places to remember and one of them will be missed.
 *
 * `deleted: 1` is the point: the same row the notes list uses, flagged, so the
 * trash is a QUERY over one table rather than a second table that has to be
 * kept consistent with the first. Restoring is one flag write.
 */
export function fromTrashedNote(
  trashed: TrashedNoteResponse,
  ownerId: number | null,
  existing?: NoteRow,
): NoteRow {
  return {
    ...fromNoteSummary(trashed.note, ownerId, existing),
    deleted: 1,
    deletedAt: trashed.deletedAt,
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
  content: string;
  pinned: boolean;
  archived: boolean;
  version: number | null;
  updatedAt: string | null;
  /**
   * When the SERVER recorded the trashing, or null.
   *
   * Null does not mean "not trashed" — `archived`/`deleted` say that. It means
   * the server has not told us when, which is the normal state for a note
   * trashed on this device while offline. The trash screen renders a timestamp
   * only when there is one rather than inventing a local approximation, because
   * a local clock and the server's are not the same clock.
   */
  deletedAt: string | null;
  /** True when there are local edits the server has not accepted. */
  unsaved: boolean;
  /**
   * When this row was last touched LOCALLY, as epoch milliseconds — the same
   * field NoteRow keeps for offline list ordering. The only timestamp
   * available before the server has accepted a first version, so the list
   * can show a real, honest date instead of a "not saved yet" placeholder
   * for a note that has simply never round-tripped yet. A genuine instant
   * (the device clock), unlike updatedAt's zoneless server LocalDateTime —
   * format it with lib/time.ts's Instant helpers, not the LocalDateTime
   * ones.
   */
  localUpdatedAt: number;
  /**
   * True only when the server permanently rejected this row's last push
   * (`syncState === 'invalid'`) — a real failure. Deliberately NOT the same
   * as `unsaved`: edited-but-not-yet-sent and offline-with-pending-changes
   * are both normal, expected states nobody did anything wrong to cause,
   * and the list should stay quiet about them (§36 aside: colour is not the
   * only signal, but here there is no signal at all unless something is
   * actually wrong).
   */
  syncFailed: boolean;
}

export function toView(row: NoteRow): NoteView {
  return {
    localId: row.localId,
    serverId: row.serverId,
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
    deletedAt: row.deletedAt,
    unsaved: row.dirty === 1,
    localUpdatedAt: row.localUpdatedAt,
    syncFailed: row.syncState === 'invalid',
  };
}

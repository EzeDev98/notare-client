import type { ServerDateTime } from '@/lib/http/types';

/*
 * The note's LOCAL shape lives with the notes feature, not in lib/db.
 *
 * lib/db owns the database — the Dexie instance, versions, indexes, and the
 * generic meta table. None of that knows what a note is. This file knows what
 * a note is and nothing about IndexedDB's API, which is the boundary 1C's rule
 * was pointing at: a row type describing titles and pinned flags is domain,
 * and infrastructure must work in a project that has never heard of a note.
 */

/**
 * How a note is stored LOCALLY.
 *
 * NOT NoteResponse. A row carries fields the server has never heard of —
 * localId, dirty, syncState, clientId — and if the two were one type, sync
 * bookkeeping would leak into every component that renders a note.
 *
 * The mapping between the two lives in one file (mappers.ts), so the
 * translation is thought about once rather than everywhere.
 */
/** What this person may do with a note (master 6.3.1). Shared notes live in `shared`. */
export type NoteRole = 'owner' | 'editor' | 'viewer';

export interface NoteRow {
  /**
   * PRIMARY KEY. A UUID we generate, stable from the moment the note exists
   * locally.
   *
   * THE NOTE'S IDENTITY IS ITS clientId. From database version 4 on, localId
   * equals clientId on every row; localId is just the name that identity has as
   * the Dexie key. serverId is only the server's label for the same note.
   *
   * NOT the server id, which is null for anything created offline —
   * IndexedDB rejects a null primary key outright. More importantly, an
   * identity that appears only after a round trip is not an identity: the
   * editor points at this note, and Step 8's outbox references it, long
   * before any server has seen it.
   */
  localId: string;

  /** Null until the server has accepted a create. */
  serverId: number | null;

  /**
   * Sent with the create so the server stores it and echoes it back on the
   * next pull.
   *
   * Without it, a note we created would come back through sync wearing an
   * unfamiliar server id and be inserted as a DUPLICATE — the user would see
   * their note twice. This is the thread that ties the two identities
   * together.
   */
  clientId: string;

  content: string;
  /*
   * 0 | 1, not boolean — INDEXEDDB CANNOT INDEX BOOLEANS.
   *
   * A boolean here is not a type error and not a runtime error. The value
   * stores fine; it simply never appears in an index, so
   * where('[ownerId+deleted+archived]').equals([1, false, false]) matches
   * NOTHING. No exception, an empty list, and a notes screen that is
   * permanently blank while the data sits in the database.
   *
   * `dirty` was already 0 | 1 for this reason. These three are in the
   * compound index and need it just as much.
   */
  pinned: 0 | 1;
  archived: 0 | 1;
  deleted: 0 | 1;

  /**
   * The optimistic-locking token, as last seen from the server. Null for a
   * note that has never been saved.
   *
   * ECHOED, never incremented — the same discipline as the editor.
   */
  version: number | null;

  /**
   * Timestamps as the SERVER expressed them: zoneless LocalDateTime.
   *
   * Kept in their original string form rather than converted on the way in.
   * Storing a Date would mean choosing a timezone interpretation at write
   * time, and lib/time.ts exists precisely because that choice belongs at
   * DISPLAY time, once, where it can be changed.
   */
  createdAt: ServerDateTime | null;
  updatedAt: ServerDateTime | null;
  deletedAt: ServerDateTime | null;

  ownerId: number | null;
  lastModifiedBy: number | null;

  /**
   * Local edits not yet accepted by the server.
   *
   * Stored as a number, not a boolean: IndexedDB CANNOT INDEX BOOLEANS. A
   * `where('dirty').equals(true)` query silently matches nothing — no error,
   * an empty result, and a sync engine that never pushes anything. 0 and 1
   * index correctly.
   */
  dirty: 0 | 1;

  /**
   * Where this row stands with the server. Step 8 drives it; Step 7 only
   * needs to store it.
   *
   * A string union rather than an enum — erasableSyntaxOnly (1B) rules out TS
   * enums, and a union compares directly against what is stored.
   */
  syncState: 'synced' | 'pending' | 'invalid';

  /**
   * When this row was last touched LOCALLY, as epoch milliseconds.
   *
   * Distinct from updatedAt, which is the server's opinion. This one orders
   * the list while offline, when the server has no opinion yet — and it is a
   * number because it is ours and never round-trips.
   */
  localUpdatedAt: number;

  /*
   * Added in database version 4. Not indexed. Rows written before version 4
   * get `role` from the upgrade; the others are absent until a step fills
   * them, so they are optional. `role` is required (step 8k).
   */

  /** What this person may do (features/notes/permissions.ts). */
  role: NoteRole;

  /** When the note will be removed for good, epoch ms. Set when it is deleted (8i). */
  purgeAt?: number | null;

  /** The owner's display name, for notes someone else owns. */
  ownerName?: string | null;

  /** The editing document's saved state (a Yjs update). Not used until step 18. */
  bodyState?: Uint8Array | null;
}

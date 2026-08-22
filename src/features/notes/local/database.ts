import Dexie, { type EntityTable } from 'dexie';

import type { MetaRow } from '@/features/notes/local/metaRow';
import type { NoteRow } from '@/features/notes/local/noteRow';
import type { OutboxRow } from '@/features/notes/local/outboxRow';

/**
 * The local database.
 *
 * SEPARATE from the auth database (4A). Clearing cached notes must not sign
 * you out, and signing out must not wipe unsynced drafts — separate databases
 * make that structural rather than a rule someone has to remember.
 *
 * IT LIVES WITH THE NOTES FEATURE, not in lib/.
 *
 * The first attempt put it in lib/db as generic infrastructure, and the layer
 * rule rejected it — correctly. A database whose tables describe titles and
 * pinned flags is not infrastructure, and the class could not even declare its
 * own table types without importing a note. There is exactly one application
 * database and it exists to hold notes; a lib/db folder would have been a
 * folder whose only purpose was to not be features/.
 *
 * Dexie rather than raw IndexedDB, and the reasoning is specific to THIS
 * store: versioned schemas with upgrade functions, promise-based transactions
 * that survive `await`, compound indexes, and useLiveQuery. The auth store has
 * one key and none of those needs, which is why it stayed on raw IndexedDB —
 * a dependency earns its existence where it is used, not globally.
 */
export class NotareDatabase extends Dexie {
  notes!: EntityTable<NoteRow, 'localId'>;
  meta!: EntityTable<MetaRow, 'key'>;
  outbox!: EntityTable<OutboxRow, 'id'>;

  /**
   * `name` defaults to 'notare' for the real app. The parameter exists for
   * database.test.ts (8A), which needs to open a database with ONLY version 1
   * present, seed it, then reopen it as THIS class — running Dexie's actual
   * upgrade function against real data, on a name isolated from the shared
   * `db` singleton every other test file uses.
   */
  constructor(name = 'notare') {
    super(name);

    /*
     * VERSION 1.
     *
     * The string lists INDEXES, not columns — IndexedDB stores whole objects,
     * so every field is persisted regardless. This declares which fields can
     * be QUERIED, and everything else requires a full scan.
     *
     * `outbox` was deliberately absent from this version. See version 2 below
     * for why, and for the migration that exercises it against real data
     * rather than an empty table.
     */
    this.version(1).stores({
      /*
       * localId is the primary key (first entry, no & prefix needed — Dexie
       * treats position one as the key).
       *
       * &serverId is UNIQUE, so two rows can never claim the same server note.
       * Unique indexes in IndexedDB permit multiple nulls, which is exactly
       * what offline-created notes need.
       *
       * The compound index is ORDERED, and the order decides what it can
       * answer. [ownerId+deleted+archived] serves the main list query
       * (mine, not deleted, not archived) and also serves [ownerId] and
       * [ownerId+deleted] as PREFIXES — but not [deleted] alone. Index design
       * is choosing which queries are cheap.
       *
       * dirty is indexed for Step 8's push, and is a NUMBER because IndexedDB
       * cannot index booleans: where('dirty').equals(true) matches nothing,
       * silently.
       */
      notes:
        'localId, &serverId, clientId, [ownerId+deleted+archived], dirty, syncState, localUpdatedAt, updatedAt',

      meta: 'key',
    });

    /*
     * EVERY VERSION STAYS IN THIS FILE FOREVER.
     *
     * A user who has not opened the app since version 1 upgrades through each
     * version in sequence on their next visit. Deleting an old version()
     * block breaks exactly those users — the ones you cannot see and will not
     * hear from.
     */

    /*
     * VERSION 2 (8A). Adds `outbox` — one row per queued CREATE, UPDATE, or
     * DELETE, in the exact shape `SyncOperationRequest` accepts (ADR-006).
     *
     * `&operationId` is UNIQUE: the idempotency key must never collide, and a
     * bug that generated the same key twice should fail loudly here rather
     * than silently drop one of the two operations at push time.
     *
     * `localId` is indexed, not unique — a note can have more than one queued
     * operation (CREATE then UPDATE), and a lookup by note needs to find all
     * of them. NOT indexed for ordering: `id`, the auto-increment primary key,
     * IS the order, for free, because it is assigned in insertion order. An
     * index on `queuedAt` would be redundant with what `id` already gives.
     *
     * WHAT THE UPGRADE FUNCTION DOES, and — as important — what it does NOT
     * do. It seeds `outbox` from whatever v1 rows are already dirty when a
     * returning user's browser runs this migration, which is the "exercised
     * against real data" this table was held back from v1 to get.
     *
     * It can only classify TWO of the cases with certainty from v1 data
     * alone:
     *
     *   - dirty AND serverId is null: the note has NEVER reached the server,
     *     by any path. Regardless of what made it dirty most recently, a
     *     CREATE is unconditionally correct — it is the only way this note
     *     reaches the server at all.
     *   - dirty AND deleted: setDeleted(true) is the only local write that
     *     sets `deleted`, and DELETE is a real SyncOperationType, so this is
     *     a DELETE.
     *
     * A THIRD case — dirty, has a serverId, not deleted — is left OUT
     * entirely, on purpose. It is genuinely ambiguous with v1 data: `dirty`
     * has always meant "something changed," for a title/content edit AND for
     * a pin/archive/restore alike (ADR-006), and v1 never recorded which.
     * Guessing UPDATE here would risk sending an unrelated title/content
     * snapshot under a possibly-stale `version` for a note the user only
     * pinned — manufacturing a conflict nobody caused. Guessing "nothing" is
     * safe: these rows are exactly as unresolved after this migration as
     * they were before it, still dirty, still visible via the note's own
     * Unsaved state, and eligible to be swept up correctly the next time
     * they are actually edited through 8B's write path — which is where the
     * general going-forward fix belongs, not a one-time migration.
     */
    this.version(2)
      .stores({
        outbox: '++id, &operationId, localId',
      })
      .upgrade(async (tx) => {
        const notes = await tx.table<NoteRow, string>('notes').where('dirty').equals(1).toArray();

        /*
         * V1 has no auto-increment sequence that represents insertion order.
         * `localId` is a UUID, so ordering by the primary key would be arbitrary.
         *
         * `localUpdatedAt` is the local ordering signal carried by every V1
         * note. When two operations happened in the same millisecond, use the
         * operation type as a deterministic tie-breaker: a CREATE must be
         * pushed before a DELETE so the resulting outbox never asks the server
         * to delete a note before that note has been created.
         */
        notes.sort((a, b) => {
          const byLocalUpdatedAt = a.localUpdatedAt - b.localUpdatedAt;
          if (byLocalUpdatedAt !== 0) return byLocalUpdatedAt;

          const aType = a.serverId === null ? 'CREATE' : a.deleted === 1 ? 'DELETE' : null;
          const bType = b.serverId === null ? 'CREATE' : b.deleted === 1 ? 'DELETE' : null;

          if (aType === bType) return 0;
          if (aType === 'CREATE') return -1;
          if (bType === 'CREATE') return 1;
          if (aType === 'DELETE') return -1;
          if (bType === 'DELETE') return 1;
          return 0;
        });

        const now = Date.now();

        const seeded: OutboxRow[] = [];

        for (const note of notes) {
          if (note.serverId === null) {
            seeded.push({
              operationId: crypto.randomUUID(),
              type: 'CREATE',
              localId: note.localId,
              clientId: note.clientId,
              noteId: null,
              content: note.content,
              version: null,
              queuedAt: now,
            });
            continue;
          }

          if (note.deleted === 1) {
            seeded.push({
              operationId: crypto.randomUUID(),
              type: 'DELETE',
              localId: note.localId,
              clientId: null,
              noteId: note.serverId,
              content: null,
              version: null,
              queuedAt: now,
            });
          }

          // The ambiguous third case: intentionally not seeded. See the
          // comment above `this.version(2)`.
        }

        if (seeded.length > 0) {
          await tx.table<OutboxRow, number>('outbox').bulkAdd(seeded);
        }
      });

    /*
     * VERSION 3 (5A). Drops the `title` column.
     *
     * No entry in `.stores({})` below — `title` was never an INDEX (the
     * `notes` index list above never named it), so there is no index
     * definition to remove. What this version exists for is the `.upgrade()`
     * beneath it: `title` was removed from `NoteRow` and `OutboxRow`'s own
     * TYPES back in 1B/5A, but IndexedDB stores whatever object it was given
     * — a device that has had this app open since before that change still
     * has a real `title` string sitting on every note and outbox row on
     * disk, invisible to the type system but very much still there. A
     * schema version bump is what runs code exactly once against every
     * existing database below it; without one, "drop the title column"
     * would only ever mean "stop writing it going forward," which is a
     * different, weaker thing than what 1B/5A actually decided.
     *
     * `.modify()`, not a manual toArray/put loop like version 2 used —
     * Dexie's own documented pattern for deleting an obsolete property, and
     * it updates each record in place without reading the whole table into
     * memory first.
     */
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('notes')
          .toCollection()
          .modify((note: Record<string, unknown>) => {
            delete note.title;
          });

        await tx
          .table('outbox')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            delete row.title;
          });
      });
  }
}

export const db = new NotareDatabase();

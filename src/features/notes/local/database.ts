import Dexie, { type EntityTable } from 'dexie';

import type { MetaRow } from '@/features/notes/local/metaRow';
import type { NoteRow } from '@/features/notes/local/noteRow';

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

  constructor() {
    super('notare');

    /*
     * VERSION 1.
     *
     * The string lists INDEXES, not columns — IndexedDB stores whole objects,
     * so every field is persisted regardless. This declares which fields can
     * be QUERIED, and everything else requires a full scan.
     *
     * `outbox` is deliberately absent. Step 8 adds it in version 2, so the
     * upgrade path gets exercised against real local data rather than being
     * theoretical. A migration you have actually run is worth more than a
     * table sitting empty for a step.
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
  }
}

export const db = new NotareDatabase();

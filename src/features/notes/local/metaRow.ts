/**
 * Key-value bookkeeping: the sync cursor, the last full sync, schema notes.
 *
 * One table rather than one per concern, because these are single values with
 * no queries against them.
 */
export interface MetaRow {
  key: string;
  value: unknown;
}

/** Keys used in the meta table, named so a typo is a compile error. */
export const META_KEYS = {
  /**
   * The sync cursor — OPAQUE.
   *
   * A LocalDateTime string the server hands us and expects back byte for
   * byte. It must never go near lib/time.ts: parsing and re-serialising
   * converts it to UTC, shifting it by the local offset and permanently
   * skipping changes.
   */
  syncCursor: 'sync.cursor',
  lastFullSyncAt: 'sync.lastFullSyncAt',
} as const;

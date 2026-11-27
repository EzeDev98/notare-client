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
  /** 'browser' once the person chose to carry on in the browser instead of installing (O-14). */
  installChoice: 'install.choice',
  /** true when voice clips may download only on Wi-Fi (Settings > Sync and storage). */
  wifiOnlyClips: 'clips.wifiOnly',
  /** When the person last pressed Check for updates, epoch ms (Settings > About). */
  updateCheckedAt: 'app.updateCheckedAt',
} as const;

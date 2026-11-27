/** A single stored value such as the sync cursor. */
export interface MetaRow {
  key: string;
  value: unknown;
}

export const META_KEYS = {
  syncCursor: 'sync.cursor',
  lastFullSyncAt: 'sync.lastFullSyncAt',
  installChoice: 'install.choice',
  wifiOnlyClips: 'clips.wifiOnly',
  updateCheckedAt: 'app.updateCheckedAt',
} as const;

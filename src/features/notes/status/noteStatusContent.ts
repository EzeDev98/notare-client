import type { NoteStatus } from '@/features/notes/status/noteStatus';

/** The words for each note status (step 8h). Shown by StatusSlot. */
export const NOTE_STATUS_WORDS: Record<NoteStatus, string> = {
  'saving-local': 'Saving on this device',
  'saved-local': 'Saved on this device',
  synced: 'Synced',
  offline: 'Offline',
  'sync-paused': 'Sync paused',
  'not-saved': 'Not saved',
  'view-only': 'View only',
};

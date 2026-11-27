/** The word for each note status. */
import type { NoteStatus } from '@/features/notes/status/noteStatus';

export const NOTE_STATUS_WORDS: Record<NoteStatus, string> = {
  'saving-local': 'Saving on this device',
  'saved-local': 'Saved on this device',
  synced: 'Synced',
  offline: 'Offline',
  'sync-paused': 'Sync paused',
  'not-saved': 'Not saved',
};

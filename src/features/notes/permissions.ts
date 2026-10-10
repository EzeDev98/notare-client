import type { NoteRole } from '@/features/notes/local/noteRow';

/**
 * What a person may do with a note, as functions of their role (step 8k).
 * This is the matrix in master 6.3.1. The UI asks these functions; it never
 * looks at `role` itself.
 *
 * | Action               | Owner | Editor | Viewer |
 * | Edit text            | yes   | yes    | no     |
 * | Record a voice clip  | yes   | yes    | no     |
 * | Transcribe a clip    | yes   | yes    | no     |
 * | Pin / Unpin          | yes   | no     | no     |
 * | Archive / Unarchive  | yes   | no     | no     |
 * | Share and manage     | yes   | no     | no     |
 * | Make a copy          | yes   | yes    | yes    |
 * | Delete               | yes   | no     | no     |
 * | Leave this note      | n/a   | yes    | yes    |
 *
 * The server enforces the same (B-13); these only decide what the screen offers.
 */
const MATRIX = {
  edit: { owner: true, editor: true, viewer: false },
  record: { owner: true, editor: true, viewer: false },
  transcribe: { owner: true, editor: true, viewer: false },
  pin: { owner: true, editor: false, viewer: false },
  archive: { owner: true, editor: false, viewer: false },
  share: { owner: true, editor: false, viewer: false },
  delete: { owner: true, editor: false, viewer: false },
  leave: { owner: false, editor: true, viewer: true },
  copy: { owner: true, editor: true, viewer: true },
} as const satisfies Record<string, Record<NoteRole, boolean>>;

export function canEdit(role: NoteRole): boolean {
  return MATRIX.edit[role];
}

export function canRecord(role: NoteRole): boolean {
  return MATRIX.record[role];
}

export function canTranscribe(role: NoteRole): boolean {
  return MATRIX.transcribe[role];
}

/** Pin and archive are the owner's private view state: never shown or applied for shared notes. */
export function canPin(role: NoteRole): boolean {
  return MATRIX.pin[role];
}

export function canArchive(role: NoteRole): boolean {
  return MATRIX.archive[role];
}

export function canShare(role: NoteRole): boolean {
  return MATRIX.share[role];
}

export function canDelete(role: NoteRole): boolean {
  return MATRIX.delete[role];
}

export function canLeave(role: NoteRole): boolean {
  return MATRIX.leave[role];
}

export function canCopy(role: NoteRole): boolean {
  return MATRIX.copy[role];
}

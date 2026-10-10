import { legacyGateway } from './legacyGateway';
import type { NoteGateway } from './NoteGateway';

export type {
  Cancellable,
  CreateNoteInput,
  ListOptions,
  NoteGateway,
  PageOptions,
  UploadClipOptions,
  UploadSharedClipOptions,
} from './NoteGateway';

/**
 * The one door to the note server. To move to a new server contract, change
 * this line to the new implementation; no screen changes.
 */
export const gateway: NoteGateway = legacyGateway;

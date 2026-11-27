/** The note-server gateway the app uses. */
import { legacyGateway } from './legacyGateway';
import type { NoteGateway } from './NoteGateway';

export type {
  Cancellable,
  CreateNoteInput,
  ListOptions,
  NoteGateway,
  PageOptions,
  UploadClipOptions,
} from './NoteGateway';

export const gateway: NoteGateway = legacyGateway;

import { createContext } from 'react';

export interface VoiceClipContextValue {
  /** The note's localId. Clips are stored against it. */
  noteId: string;
  canEdit: boolean;
  canTranscribe: boolean;
}

/** Given by the note editor so a voice block knows which note it lives in. */
export const VoiceClipContext = createContext<VoiceClipContextValue | null>(null);

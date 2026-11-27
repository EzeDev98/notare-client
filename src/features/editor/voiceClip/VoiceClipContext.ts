/** Context the voice clip blocks read from their note. */
import { createContext } from 'react';

export interface VoiceClipContextValue {
  noteId: string;
}

export const VoiceClipContext = createContext<VoiceClipContextValue | null>(null);

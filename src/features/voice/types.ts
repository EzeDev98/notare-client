/** Voice clip and transcription types as the server sends them. */
import type { ServerDateTime } from '@/lib/http/types';

export interface VoiceNoteResponse {
  id: number;
  ownerId: number;
  noteId: number | null;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  createdAt: ServerDateTime;
}

export type TranscriptionResponse =
  | { voiceNoteId: number; status: 'PENDING' }
  | { voiceNoteId: number; status: 'PROCESSING' }
  | {
      voiceNoteId: number;
      status: 'COMPLETED';
      transcript: string;
      confidence: number | null;
      language: string | null;
    }
  | { voiceNoteId: number; status: 'FAILED'; errorMessage: string };

export type TranscriptionStatus = TranscriptionResponse['status'];

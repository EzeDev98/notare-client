/** Builders for voice clips and transcriptions used in tests. */
import type { TranscriptionResponse, VoiceNoteResponse } from '@/features/voice/types';

let nextVoiceNoteId = 1;

export function makeVoiceNote(overrides: Partial<VoiceNoteResponse> = {}): VoiceNoteResponse {
  const id = overrides.id ?? nextVoiceNoteId++;
  return {
    id,
    ownerId: 1,
    noteId: 5,
    contentType: 'audio/webm',
    sizeBytes: 245_760,
    durationSeconds: 12,
    createdAt: '2026-08-10T09:00:00.000',
    ...overrides,
  };
}

export function makeTranscription(
  overrides: Partial<TranscriptionResponse> = {},
): TranscriptionResponse {
  const base = { voiceNoteId: 1, status: 'COMPLETED' as const, transcript: 'This is a test transcript.', confidence: 0.94, language: 'en' };
  return { ...base, ...overrides } as TranscriptionResponse;
}

export function resetVoiceFixtures(): void {
  nextVoiceNoteId = 1;
}

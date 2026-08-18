import type { VoiceShareResponse } from '@/features/voiceSharing/types';

let nextVoiceShareId = 1;

/**
 * A builder for the OWNER side's `/voice-notes/{id}/shares` rows — the
 * voice-note counterpart to `makeShare` (notes). `sharedWithUserId`
 * defaults to 2, same reasoning as `makeShare`'s own default: matches
 * `makeCollaboration`'s default `collaboratorId`, so a test wiring a voice
 * grant against a fixture collaboration resolves a name by default.
 */
export function makeVoiceShare(overrides: Partial<VoiceShareResponse> = {}): VoiceShareResponse {
  const id = overrides.id ?? nextVoiceShareId++;
  return {
    id,
    voiceNoteId: 5,
    ownerId: 1,
    sharedWithUserId: 2,
    permission: 'READ',
    createdAt: '2026-08-10T09:00:00.000',
    updatedAt: '2026-08-10T09:00:00.000',
    ...overrides,
  };
}

export function resetVoiceShareFixtures(): void {
  nextVoiceShareId = 1;
}

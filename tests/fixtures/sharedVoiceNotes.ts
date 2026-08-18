import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';

let nextShareId = 1;

/**
 * A builder, not a constant — same reasoning as `makeSharedNoteSummary`
 * next door. `ownerId` defaults to 2, matching `makeCollaboration`'s
 * default `collaboratorId` and `makeShare`'s default `sharedWithUserId` —
 * so a test wiring a shared voice note against the default collaboration
 * fixture resolves an owner name by default instead of falling back to
 * "Unknown user".
 */
export function makeSharedVoiceNoteSummary(
  overrides: Partial<SharedVoiceNoteSummaryResponse> = {},
): SharedVoiceNoteSummaryResponse {
  const shareId = overrides.shareId ?? nextShareId++;
  return {
    shareId,
    voiceNoteId: 1,
    noteId: null,
    ownerId: 2,
    permission: 'READ',
    originalFilename: null,
    contentType: 'audio/webm',
    sizeBytes: 245_760,
    durationSeconds: 12,
    createdAt: '2026-08-10T09:00:00.000',
    sharedAt: '2026-08-10T09:05:00.000',
    ...overrides,
  };
}

export function resetSharedVoiceNoteFixtures(): void {
  nextShareId = 1;
}

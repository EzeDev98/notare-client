import type { NoteShareResponse } from '@/features/sharing/types';

let nextShareId = 1;

/**
 * A builder, not a constant — same reasoning as `makeCollaboration` next
 * door in `./collaboration`. `sharedWithUserId` defaults to 2, matching
 * `makeCollaboration`'s default `collaborator` id (100+ counter aside —
 * see that file), so a test wiring a grant against a fixture collaboration
 * resolves a name by default instead of falling back to `User {id}`.
 */
export function makeShare(overrides: Partial<NoteShareResponse> = {}): NoteShareResponse {
  const id = overrides.id ?? nextShareId++;
  return {
    id,
    noteId: 5,
    sharedWithUserId: 2,
    permission: 'READ',
    sharedAt: '2026-08-10T09:00:00.000',
    ...overrides,
  };
}

export function resetShareFixtures(): void {
  nextShareId = 1;
}

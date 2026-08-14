import type { CollaborationResponse, UserSummaryResponse } from '@/features/collaboration/types';

let nextUserId = 100;
let nextCollaborationId = 1;

export function makeUserSummary(overrides: Partial<UserSummaryResponse> = {}): UserSummaryResponse {
  const id = overrides.id ?? nextUserId++;
  return {
    id,
    notarianId: `NTR-${String(id)}`,
    username: `user${String(id)}`,
    firstName: 'Ada',
    lastName: 'Lovelace',
    ...overrides,
  };
}

export function makeCollaboration(
  overrides: Partial<CollaborationResponse> = {},
): CollaborationResponse {
  const id = overrides.id ?? nextCollaborationId++;
  return {
    id,
    noteId: 5,
    noteTitle: 'Note 5',
    owner: makeUserSummary({ id: 1, username: 'owner' }),
    collaborator: makeUserSummary({ id: 2, username: 'collaborator' }),
    permission: 'READ',
    status: 'PENDING',
    createdAt: '2026-08-10T09:00:00.000',
    ...overrides,
  };
}

export function resetCollaborationFixtures(): void {
  nextUserId = 100;
  nextCollaborationId = 1;
}

import type { CollaborationResponse, UserSummaryResponse } from '@/features/collaboration/types';

let nextUserId = 100;
let nextCollaborationId = 1;

export function makeUserSummary(
  overrides: Partial<UserSummaryResponse> = {},
): UserSummaryResponse {
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
    ownerId: 1,
    collaboratorId: 2,
    status: 'PENDING',
    createdAt: '2026-08-10T09:00:00.000',
    updatedAt: '2026-08-10T09:00:00.000',
    ...overrides,
  };
}

export function resetCollaborationFixtures(): void {
  nextUserId = 100;
  nextCollaborationId = 1;
}

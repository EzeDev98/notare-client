import type { UserSummaryResponse } from '@/features/userLookup/types';

export function makeLookupUser(overrides: Partial<UserSummaryResponse> = {}): UserSummaryResponse {
  const id = overrides.id ?? 2;
  if (id === 9 && overrides.firstName === undefined && overrides.lastName === undefined) {
    return { id, username: 'femi.ade', firstName: 'Femi', lastName: 'Ade', ...overrides };
  }
  return {
    id,
    username: `user${String(id)}`,
    firstName: 'Jane',
    lastName: 'Doe',
    ...overrides,
  };
}

import type { UserSummaryResponse } from '@/features/userLookup/types';

/**
 * A builder for `GET /user/lookup` rows. Defaults to "Jane Doe" regardless
 * of which id is requested — matching the convention several pre-existing
 * test files (`ShareNote.test.tsx`, `Invitations.test.tsx`) already assume
 * for the default `collaboratorId: 2` fixture (`makeCollaboration`), even
 * though no `/user/lookup` handler existed yet to back that assumption.
 * This fixture is what makes those assertions actually true rather than
 * coincidentally-worded.
 *
 * A SEPARATE type from `features/collaboration/types.ts`'s own
 * `UserSummaryResponse` (that one carries `notarianId`, this one doesn't) —
 * see `features/userLookup/types.ts`'s own doc comment on why the two
 * aren't reconciled. This fixture builds the lookup-specific shape only.
 */
export function makeLookupUser(overrides: Partial<UserSummaryResponse> = {}): UserSummaryResponse {
  const id = overrides.id ?? 2;
  return {
    id,
    username: `user${String(id)}`,
    firstName: 'Jane',
    lastName: 'Doe',
    ...overrides,
  };
}

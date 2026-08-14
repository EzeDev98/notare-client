import { makeNoteSummary } from './notes';

import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';

/**
 * A builder, not a constant — same reasoning as `makeNote` next door. Shares
 * `makeNoteSummary`'s id counter (from `./notes`) rather than keeping a
 * second one, so a test mixing owner and shared fixtures never collides on
 * an id by accident.
 */
export function makeSharedNoteSummary(
  overrides: Partial<SharedNoteSummaryResponse> = {},
): SharedNoteSummaryResponse {
  return {
    note: makeNoteSummary(),
    permission: 'READ',
    ownerId: 2,
    sharedAt: '2026-08-02T10:00:00.000',
    ...overrides,
  };
}

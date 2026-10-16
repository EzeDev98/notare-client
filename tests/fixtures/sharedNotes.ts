import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';

let nextShareId = 1;
let nextNoteId = 9000;

/** A builder, not a constant: each call gets fresh ids. */
export function makeSharedNoteSummary(
  overrides: Partial<SharedNoteSummaryResponse> = {},
): SharedNoteSummaryResponse {
  return {
    shareId: nextShareId++,
    noteId: nextNoteId++,
    title: 'Shared note',
    contentPreview: 'Shared note',
    ownerName: 'Jane Doe',
    role: 'VIEWER',
    updatedAt: '2026-08-01T10:00:00.000',
    sharedAt: '2026-08-02T10:00:00.000',
    ...overrides,
  };
}

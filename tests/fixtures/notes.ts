import type { NoteRow } from '@/features/notes/local/noteRow';
import type { NoteResponse, NoteSummaryResponse } from '@/features/notes/types';
import type { PagedResponse } from '@/lib/http/types';

/**
 * Builders, not constants.
 *
 * A shared SAMPLE_NOTE object gets mutated by one test and breaks another, and
 * it forces every test to care about every field. A builder lets a test state
 * ONLY what it is about — makeNote({ version: 3 }) says "this test is about
 * version 3" and the rest is deliberately boring.
 */

let nextId = 1;

export function makeNote(overrides: Partial<NoteResponse> = {}): NoteResponse {
  const id = overrides.id ?? nextId++;

  return {
    id,
    content: 'Body text.',
    pinned: false,
    version: 0,
    // No timezone, exactly as the server sends it.
    createdAt: '2026-08-01T09:00:00.000',
    updatedAt: '2026-08-01T09:00:00.000',
    ownerId: 1,
    lastModifiedBy: 1,
    ...overrides,
  };
}

/**
 * A LOCAL row, which is what the editor and the list now take.
 *
 * Separate from makeNote because they are separate types on purpose: a row
 * carries localId, dirty and syncState, which the server has never heard of.
 * A test that wants "a note the server holds" builds a NoteResponse; a test
 * that wants "a note on this device" builds a row.
 */
export function makeRow(overrides: Partial<NoteRow> = {}): NoteRow {
  const serverId = overrides.serverId ?? nextId++;
  const localId = overrides.localId ?? `local-${String(serverId)}`;

  return {
    localId,
    serverId,
    clientId: localId,
    content: 'Body text.',
    pinned: 0,
    deleted: 0,
    version: 0,
    createdAt: '2026-08-01T09:00:00.000',
    updatedAt: '2026-08-01T09:00:00.000',
    deletedAt: null,
    ownerId: 1,
    lastModifiedBy: 1,
    dirty: 0,
    syncState: 'synced',
    localUpdatedAt: 1_754_038_800_000,
    ...overrides,
  };
}

export function makeNoteSummary(overrides: Partial<NoteSummaryResponse> = {}): NoteSummaryResponse {
  const id = overrides.id ?? nextId++;

  return {
    id,
    contentPreview: 'Body text.',
    pinned: false,
    version: 0,
    updatedAt: '2026-08-01T09:00:00.000',
    ...overrides,
  };
}

/**
 * Wraps content in the server's pagination envelope, deriving the flags rather
 * than letting a test set them inconsistently — a page claiming hasNext with
 * totalPages 1 is a fixture that tests nothing real.
 */
export function makePage<T>(
  content: T[],
  overrides: Partial<PagedResponse<T>> = {},
): PagedResponse<T> {
  const size = overrides.size ?? 20;
  const page = overrides.page ?? 0;
  const totalElements = overrides.totalElements ?? content.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));

  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    hasNext: page < totalPages - 1,
    hasPrevious: page > 0,
    ...overrides,
  };
}

/** Resets the id counter so ids are predictable per test file. */
export function resetNoteFixtures(): void {
  nextId = 1;
}

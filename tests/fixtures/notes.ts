/** Builders for notes, note rows and pages used in tests. */
import type { NoteRow } from '@/features/notes/local/noteRow';
import type { NoteResponse, NoteSummaryResponse } from '@/features/notes/types';
import type { PagedResponse } from '@/lib/http/types';

let nextId = 1;

export function makeNote(overrides: Partial<NoteResponse> = {}): NoteResponse {
  const id = overrides.id ?? nextId++;

  return {
    id,
    content: 'Body text.',
    pinned: false,
    version: 0,
    createdAt: '2026-08-01T09:00:00.000',
    updatedAt: '2026-08-01T09:00:00.000',
    ownerId: 1,
    lastModifiedBy: 1,
    ...overrides,
  };
}

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

export function resetNoteFixtures(): void {
  nextId = 1;
}

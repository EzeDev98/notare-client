/** Converts between server notes and local note rows. */
import type { NoteRow } from '@/features/notes/local/noteRow';
import type { NoteResponse, NoteSummaryResponse } from '@/features/notes/types';

export function flag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function newLocalId(): string {
  return crypto.randomUUID();
}

function keepLocalFields(existing: NoteRow | undefined): Partial<Pick<NoteRow, 'bodyState'>> {
  const bodyState = existing?.bodyState;
  return bodyState === undefined ? {} : { bodyState };
}

export function syncStateFor(serverId: number | null, clean: boolean): NoteRow['syncState'] {
  return clean && serverId !== null ? 'synced' : 'pending';
}

export function createLocalNote(
  ownerId: number | null,
  fields: { content?: string; id?: string } = {},
): NoteRow {
  const localId = fields.id ?? newLocalId();

  return {
    localId,
    serverId: null,
    clientId: localId,
    content: fields.content ?? '',
    pinned: 0,
    deleted: 0,
    version: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ownerId,
    lastModifiedBy: null,
    dirty: 1,
    syncState: 'pending',
    localUpdatedAt: Date.now(),
  };
}

export function isSameRow(existing: NoteRow, next: NoteRow): boolean {
  return (Object.keys(next) as (keyof NoteRow)[]).every((key) => existing[key] === next[key]);
}

export function fromNoteResponse(note: NoteResponse, existing?: NoteRow): NoteRow {
  const localId = existing?.localId ?? newLocalId();
  return {
    localId,
    serverId: note.id,
    clientId: existing?.clientId ?? localId,
    content: note.content ?? '',
    pinned: flag(note.pinned),
    deleted: existing?.deleted ?? 0,
    version: note.version,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: existing?.deletedAt ?? null,
    ownerId: note.ownerId,
    lastModifiedBy: note.lastModifiedBy,
    restorable: note.restorable === true,
    aiTitle: note.aiTitle ?? null,
    dirty: 0,
    syncState: 'synced',
    localUpdatedAt: existing?.localUpdatedAt ?? Date.now(),
    ...keepLocalFields(existing),
  };
}

export function fromNoteSummary(
  summary: NoteSummaryResponse,
  ownerId: number | null,
  existing?: NoteRow,
): NoteRow {
  const localId = existing?.localId ?? newLocalId();
  return {
    localId,
    serverId: summary.id,
    clientId: existing?.clientId ?? localId,
    content: existing?.content ?? '',
    pinned: flag(summary.pinned),
    deleted: 0,
    version: summary.version,
    createdAt: existing?.createdAt ?? null,
    updatedAt: summary.updatedAt,
    deletedAt: null,
    ownerId: existing?.ownerId ?? ownerId,
    lastModifiedBy: existing?.lastModifiedBy ?? null,
    restorable: existing?.restorable === true && existing.version === summary.version,
    aiTitle: existing?.aiTitle ?? null,
    dirty: existing?.dirty ?? 0,
    syncState: existing?.syncState ?? 'synced',
    localUpdatedAt: existing?.localUpdatedAt ?? Date.now(),
    ...keepLocalFields(existing),
  };
}

export interface NoteView {
  localId: string;
  serverId: number | null;
  content: string;
  pinned: boolean;
  version: number | null;
  updatedAt: string | null;
  deletedAt: string | null;
  unsaved: boolean;
  localUpdatedAt: number;
  syncFailed: boolean;
}

export function toView(row: NoteRow): NoteView {
  return {
    localId: row.localId,
    serverId: row.serverId,
    content: row.content,
    pinned: row.pinned === 1,
    version: row.version,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    unsaved: row.dirty === 1,
    localUpdatedAt: row.localUpdatedAt,
    syncFailed: row.syncState === 'invalid',
  };
}

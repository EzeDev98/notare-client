import type { ServerDateTime } from '@/lib/http/types';

/**
 * The note domain's wire types, mirroring the server's DTOs.
 */

/** A single note, in full. */
export interface NoteResponse {
  id: number;
  content: string | null;
  pinned: boolean;
  archived: boolean;

  /** A change counter kept by the server. Informational only; never sent back. */
  version: number;

  createdAt: ServerDateTime;
  updatedAt: ServerDateTime;
  ownerId: number;
  lastModifiedBy: number | null;
}

/** A note as it appears in a list — no full content. */
export interface NoteSummaryResponse {
  id: number;
  contentPreview: string | null;
  pinned: boolean;
  archived: boolean;
  version: number;
  updatedAt: ServerDateTime;
}

/** A trashed note: the ordinary summary plus when it was trashed (B4). */
export interface TrashedNoteResponse {
  note: NoteSummaryResponse;

  /**
   * NOT the basis for a countdown. Nothing on the server purges trashed notes
   * — SyncRetentionJob touches the sync tables only — so a UI promising
   * "deleted in 30 days" would be lying.
   */
  deletedAt: ServerDateTime | null;
}

export interface CreateNoteRequest {
  content?: string;
}

/**
 * Full replacement (PUT). Both fields REQUIRED, and null CLEARS.
 *
 * Structurally different from AutoSaveNoteRequest below, and that is the whole
 * point: required-and-nullable versus optional means passing one where the
 * other is expected does not compile.
 *
 * The architecture doc proposed branding these to prevent the mix-up. A brand
 * turned out to be unnecessary — the semantic difference IS a type difference,
 * and a type difference that reflects reality beats one that merely asserts
 * it. Confusing the two wipes a note, so the compiler doing this for free is
 * worth more than the ceremony.
 */
export interface UpdateNoteRequest {
  content: string | null;
}

/**
 * Partial update (PATCH) — auto-save.
 *
 * An OMITTED field means "leave it alone". To CLEAR a field, send an empty
 * string, not null.
 */
export interface AutoSaveNoteRequest {
  content?: string;
}

import type { SharePermission } from '@/features/sharing/types';
import type { ServerDateTime } from '@/lib/http/types';

/**
 * The RECIPIENT side's wire types for `/shared-voice-notes`. Mirrors
 * `features/sharedNotes/types.ts`'s framing (separate collection from
 * `/voice-notes`, same no-grant-is-404 / grant-too-weak-is-403 story), but
 * NOT its shape — see `SharedVoiceNoteSummaryResponse` below for the two
 * deliberate divergences.
 *
 * `SharePermission` re-exported from `features/sharing/types`, same as
 * `features/voiceSharing/types.ts` — one shared type, not a third
 * redeclaration of 'READ' | 'WRITE'.
 */
export type { SharePermission };

/**
 * A row in "voice notes shared with me". `GET /shared-voice-notes` (list)
 * AND `GET /shared-voice-notes/{voiceNoteId}` (single) both return this
 * SAME shape — confirmed against the server's actual
 * `SharedVoiceNoteSummaryResponse` record, not inferred.
 *
 * Two deliberate divergences from `SharedNoteSummaryResponse`, not
 * inconsistencies to fix:
 *
 * 1. FLATTENED, not nested — no embedded voice-note object. A voice note's
 *    metadata is already flat and small, so nesting would add a JSON level
 *    with nothing underneath to justify it (the server DTO's own doc
 *    comment).
 * 2. `permission` is present here AND on the single-GET response. Unlike
 *    the note side (`useSharedNotePermission`'s whole reason for existing:
 *    `GET /shared-notes/{id}` returns the owner's bare `NoteResponse` with
 *    no permission field at all), there is no gap to work around on the
 *    voice side — a direct visit to `/shared-voice/:id` has a reliable
 *    permission source on its own. No cache-scavenging hook needed here.
 *
 * `storageKey` is excluded, same reasoning as the owner-side
 * `VoiceNoteResponse`: an internal storage detail, never exposed. Audio is
 * reached through the grant-gated stream/download endpoints only.
 */
export interface SharedVoiceNoteSummaryResponse {
  /** The grant's own id — present so the client can address it if it ever needs to, though nothing here does yet. */
  shareId: number;
  voiceNoteId: number;
  /** The parent text note, or null for a standalone voice note. */
  noteId: number | null;
  /** Who shared it with me. */
  ownerId: number;
  /** What I may do with it. READ-only in practice today — the grant-gated endpoints only check for READ — kept as the full enum so WRITE has somewhere to land later. */
  permission: SharePermission;
  /** Null when the original upload had no filename, same as the owner-side entity field. */
  originalFilename: string | null;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  /** When the voice note was originally uploaded. */
  createdAt: ServerDateTime;
  /** When it was shared with me. Distinct from `createdAt` above. */
  sharedAt: ServerDateTime;
}

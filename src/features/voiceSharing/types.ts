import type { SharePermission } from '@/features/sharing/types';
import type { ServerDateTime } from '@/lib/http/types';

/**
 * The OWNER side's wire types for `/voice-notes/{voiceNoteId}/shares`.
 * Mirrors `features/sharing/types.ts` structurally — same three-way split
 * (owner grants vs. `sharedVoiceNotes` recipient view vs. collaboration),
 * same two-stage rule that sharing requires an accepted collaboration
 * first, enforced by the picker, not re-derived here.
 *
 * `SharePermission` is re-exported from `features/sharing/types` rather
 * than redeclared — mirrors the server's own choice to reuse
 * `com.notare.feature.share.enums.SharePermission` for voice shares
 * instead of a duplicate enum (VoiceShare's own doc comment).
 */
export type { SharePermission };

/**
 * One row from `GET /voice-notes/{voiceNoteId}/shares`.
 *
 * UNLIKE `NoteShareResponse` (inferred — no documented response DTO on the
 * note side), this shape is CONFIRMED against the server's actual
 * `VoiceShareResponse` record: `id`, `voiceNoteId`, `ownerId`,
 * `sharedWithUserId`, `permission`, `createdAt`, `updatedAt`. Two concrete
 * differences from the note-side type worth flagging, not "fixing" there:
 * this carries `ownerId` (the note-side type doesn't), and it has separate
 * `createdAt`/`updatedAt` rather than a single collapsed `sharedAt`.
 *
 * `sharedWithUserId` is still a bare number, not a nested profile — same
 * G1 reasoning as the note side: resolve it via the batch user-lookup
 * feature, not by assuming the collaboration convention (nested
 * `UserSummaryResponse`) carried over.
 */
export interface VoiceShareResponse {
  id: number;
  voiceNoteId: number;
  ownerId: number;
  sharedWithUserId: number;
  permission: SharePermission;
  createdAt: ServerDateTime;
  updatedAt: ServerDateTime;
}

/**
 * `POST /voice-notes/{voiceNoteId}/shares` body — mirrors
 * `CreateShareRequest`. `voiceNoteId` is in the URL and `ownerId` is never
 * client-supplied, same reasoning as the note side: both would permanently
 * equal the authenticated caller regardless of what the body said.
 */
export interface CreateVoiceShareRequest {
  sharedWithUserId: number;
  permission: SharePermission;
}

/**
 * `PUT /voice-notes/{voiceNoteId}/shares/{userId}` body — mirrors
 * `UpdateShareRequest`. `permission` is the only mutable field on a grant
 * (VoiceShare's own doc comment), so it's the only thing left to send.
 */
export interface UpdateVoiceShareRequest {
  permission: SharePermission;
}

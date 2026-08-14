import type { NoteResponse, NoteSummaryResponse } from '@/features/notes/types';
import type { ServerDateTime } from '@/lib/http/types';

/**
 * The RECIPIENT side's wire types. Deliberately a separate module from
 * `features/notes/types.ts`, mirroring the server's own split.
 *
 * NOTARE-SERVER.md §9: `/notes/**` stays strictly owner-only; `/shared-notes`
 * is a separate collection for "shared with me", chosen specifically so the
 * share module depends on the note module and not the other way round.
 * NOTARE-CLIENT-ARCHITECTURE.md §2.4 carries that split all the way up to
 * routing (`/notes/:id` vs `/shared/:id`) for the same reason stated there:
 * merging them in one "smart" component is how the wrong authorization model
 * gets applied.
 */

/**
 * `WRITE` implies `READ` server-side (`SharePermission.satisfies`, ranked by
 * enum ordinal). The client never re-derives that ordering — every check
 * against this value is a direct equality, not our own ranking of the two
 * strings, so a future third permission level cannot silently slot into the
 * wrong place in a comparison we invented here.
 *
 * `WRITE` = edit title and content only. Never pin, archive, or delete — the
 * server does not expose those actions on this path at all, and the UI must
 * not render those affordances for a shared note regardless of permission.
 */
export type SharePermission = 'READ' | 'WRITE';

/**
 * A row on the "Shared with me" list. `GET /shared-notes`.
 *
 * Nests the owner's `NoteSummaryResponse` rather than flattening it —
 * matches the server's own DTO shape (NOTARE-SERVER.md §3.6, "response DTOs
 * are nested, not flattened"), so a field added to `NoteSummaryResponse`
 * appears here for free instead of needing a parallel copy kept in sync.
 */
export interface SharedNoteSummaryResponse {
  note: NoteSummaryResponse;
  permission: SharePermission;
  ownerId: number;
  sharedAt: ServerDateTime;
}

/**
 * A single shared note in full — the response from both
 * `GET /shared-notes/{noteId}` (requires READ) and
 * `PUT /shared-notes/{noteId}` (requires WRITE).
 *
 * THIS IS THE OWNER'S `NoteResponse`, not a distinct shape. There is no
 * `SharedNoteDetailResponse` on the server yet: NOTARE-SERVER.md's hardening
 * backlog lists it as deferred (Step 7), with the consequence spelled out
 * verbatim — "Shared reads currently expose the owner's `pinned`/`archived`."
 * Those two fields on this object are the OWNER's private view state, not
 * the recipient's. Reading them for anything is a latent bug, not a
 * coincidence worth building on — the UI must not surface pin/archive
 * affordances for a shared note no matter what this payload contains
 * (NOTARE-CLIENT-ARCHITECTURE.md §2.4).
 *
 * Aliased rather than redeclared so that if the server ever ships a real
 * `SharedNoteDetailResponse`, updating this one line is the whole migration
 * — not a silent, permanent widening of the owner's own type to match it.
 */
export type SharedNoteDetailResponse = NoteResponse;

/**
 * Full replacement — the body for `PUT /shared-notes/{noteId}`.
 *
 * Same shape as the owner's `UpdateNoteRequest` (both fields required, null
 * clears) because it is the SAME server-side write path under the hood:
 * `updateAuthorizedNote` is "character-for-character identical to
 * `updateNote` below the lookup" (NOTARE-SERVER.md §9) so the body it will
 * accept cannot differ from the owner's.
 *
 * THERE IS NO PATCH EQUIVALENT. G7
 * (NOTARE-CLIENT-ARCHITECTURE.md §1.3): recipients get PUT only — the server
 * has no `autoSaveAuthorizedNote`. A WRITE collaborator's editor therefore
 * cannot auto-save on keystroke the way the owner's editor does; it saves on
 * blur or an explicit action instead. That is a deliberate UI difference the
 * missing endpoint forces (per the gap analysis: "must be a deliberate UI
 * difference, not an accident"), not something to paper over by polling PUT
 * on a timer.
 */
export interface UpdateSharedNoteRequest {
  title: string | null;
  content: string | null;
  version: number;
}

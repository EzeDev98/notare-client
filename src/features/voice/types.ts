import type { ServerDateTime } from '@/lib/http/types';

/**
 * NOTARE-SERVER.md §6: "`VoiceNote`: `ownerId`, optional `noteId` link,
 * `contentType`, immutable `storageKey`, `sizeBytes`, `durationSeconds`.
 * Hard delete." `storageKey` is deliberately absent here — it's an
 * internal storage-strategy detail (which `FileStorageService`
 * implementation resolves it), not something a client should ever see or
 * need; the client's only handles on the bytes are `/download` and
 * `/stream`.
 *
 * INFERRED response shape (entity fields per §6, not a documented DTO
 * listing) — flagged per this repo's own convention for an inferred type.
 */
export interface VoiceNoteResponse {
  id: number;
  ownerId: number;
  /** Null for a voice note not yet linked to any note. */
  noteId: number | null;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  createdAt: ServerDateTime;
}

/**
 * §7: "Status: `PENDING → PROCESSING → COMPLETED | FAILED`." Modelled as
 * ONE discriminated union, not four booleans — architecture doc §2.6 states
 * this as a requirement verbatim: "`transcript`/`confidence`/`language`
 * only exist on `COMPLETED`; `errorMessage` only on `FAILED`. The type
 * should make reading `transcript` on a `PENDING` value a compile error."
 * Reading `.transcript` on a `TranscriptionResponse` typed only as
 * `{status: 'PENDING'}` is exactly that: a compile error, not a runtime
 * `undefined`.
 */
export type TranscriptionResponse =
  | { voiceNoteId: number; status: 'PENDING' }
  | { voiceNoteId: number; status: 'PROCESSING' }
  | {
      voiceNoteId: number;
      status: 'COMPLETED';
      transcript: string;
      confidence: number | null;
      language: string | null;
    }
  | { voiceNoteId: number; status: 'FAILED'; errorMessage: string };

export type TranscriptionStatus = TranscriptionResponse['status'];

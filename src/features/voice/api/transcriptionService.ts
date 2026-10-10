import { httpClient } from '@/lib/http/client';
import type { TranscriptionResponse } from '@/features/voice/types';

/**
 * `/voice-notes/{id}/transcription` — NOTARE-SERVER.md §7/§13.
 *
 * No `noteId` anywhere here — transcription is 1:1 with a VOICE NOTE
 * (`UNIQUE voice_note_id`, §7), not with the note it might be linked to.
 */

interface Cancellable {
  signal?: AbortSignal;
}

export const transcriptionService = {
  /**
   * `POST /voice-notes/{id}/transcription` — 202 + `Location` (unreadable,
   * per architecture doc §1.2 — the body is what matters, same as every
   * other 201/202 in this codebase).
   *
   * IDEMPOTENT (§7's own wording): PENDING/PROCESSING/COMPLETED all return
   * as-is; FAILED resets to PENDING and republishes. That means "submit"
   * and "retry after a failure" are THE SAME CALL — `useTranscriptionMutations`
   * has no separate retry function because the server doesn't need one.
   */
  submitTranscription(
    voiceNoteId: number,
    { signal }: Cancellable = {},
  ): Promise<TranscriptionResponse> {
    return httpClient.post<TranscriptionResponse>(
      `/voice-notes/${String(voiceNoteId)}/transcription`,
      {
        ...(signal ? { signal } : {}),
      },
    );
  },

  /** `GET /voice-notes/{id}/transcription` — "poll for status" (§13). */
  getTranscription(
    voiceNoteId: number,
    { signal }: Cancellable = {},
  ): Promise<TranscriptionResponse> {
    return httpClient.get<TranscriptionResponse>(
      `/voice-notes/${String(voiceNoteId)}/transcription`,
      {
        ...(signal ? { signal } : {}),
      },
    );
  },
};

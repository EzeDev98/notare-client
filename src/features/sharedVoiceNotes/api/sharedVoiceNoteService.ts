import { getAuthHooks } from '@/lib/http/authHooks';
import { env } from '@/lib/config/env';
import { ApiError } from '@/lib/http/errors';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';
import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';

/**
 * The recipient side of voice sharing: `/shared-voice-notes`. Never
 * `/voice-notes` — same authorization-question split as `sharedNoteService`
 * vs `noteService`: `/voice-notes` answers "is this your voice note?",
 * this collection answers "do you hold a grant?".
 *
 * NOTHING HERE CATCHES, same rule as every other service in this codebase:
 * a 403 (grant too weak) and a 404 (no grant at all) must reach the caller
 * distinguishable, not collapsed into one generic failure here.
 */

const SHARED_VOICE_NOTES = '/shared-voice-notes';

interface Cancellable {
  signal?: AbortSignal;
}

interface ListOptions extends Cancellable {
  /** Zero-based, same convention as `sharedNoteService.listSharedNotes`. */
  page?: number;
  size?: number;
}

export const sharedVoiceNoteService = {
  /** Voice notes shared WITH the current user, sorted by when they were shared, newest first — the server's fixed order, no sort param to override it. */
  listSharedWithMe({ page, size, signal }: ListOptions = {}): Promise<
    PagedResponse<SharedVoiceNoteSummaryResponse>
  > {
    return httpClient.get<PagedResponse<SharedVoiceNoteSummaryResponse>>(SHARED_VOICE_NOTES, {
      query: { page, size },
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Requires at least READ — the minimum grant this collection exposes at
   * all, so holding any grant satisfies it. No grant means 404, same as an
   * owner-only voice note someone else asks for.
   */
  getSharedVoiceNote(
    voiceNoteId: number,
    { signal }: Cancellable = {},
  ): Promise<SharedVoiceNoteSummaryResponse> {
    return httpClient.get<SharedVoiceNoteSummaryResponse>(
      `${SHARED_VOICE_NOTES}/${String(voiceNoteId)}`,
      { ...(signal ? { signal } : {}) },
    );
  },

  /**
   * `GET /shared-voice-notes/{id}/download` — the FULL file, fetched as an
   * authenticated `Blob`, mirroring `voiceService.downloadVoiceNoteBlob`
   * exactly and for the identical reason (G5): `/stream` needs an
   * `Authorization` header no `<audio src>` can send, and the service-worker
   * fix that would let `/stream` be used directly doesn't exist yet on
   * EITHER side of sharing — not just this one. Not a divergence from the
   * owner-side player, a deliberate parity with it.
   */
  async downloadSharedVoiceNoteBlob(voiceNoteId: number, { signal }: Cancellable = {}): Promise<Blob> {
    const hooks = getAuthHooks();
    const authorization = hooks ? await hooks.getAuthorization() : null;

    const response = await fetch(
      `${env.apiBaseUrl}${SHARED_VOICE_NOTES}/${String(voiceNoteId)}/download`,
      {
        headers: authorization !== null ? { Authorization: authorization } : {},
        ...(signal ? { signal } : {}),
      },
    );

    if (!response.ok) {
      throw new ApiError({ kind: 'http', status: response.status, body: null });
    }

    return response.blob();
  },
};

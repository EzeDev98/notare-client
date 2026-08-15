import { getAuthHooks } from '@/lib/http/authHooks';
import { env } from '@/lib/config/env';
import { ApiError } from '@/lib/http/errors';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';
import type { VoiceNoteResponse } from '@/features/voice/types';

/**
 * `/voice-notes` — NOTARE-SERVER.md §6/§13.
 *
 * Upload and download are NOT `httpClient` calls. `httpClient` speaks JSON
 * (`prepareBody` in lib/http/client.ts branches on `FormData` already, so a
 * plain multipart POST would work through it) — but upload needs UPLOAD
 * PROGRESS, which `fetch` cannot report, and download needs a `Blob`
 * response, which `httpClient`'s `parseResponse` doesn't handle. Both use
 * a raw `XMLHttpRequest`/`fetch` here instead, reusing `getAuthHooks()` for
 * the SAME token attachment `httpClient` gives everything else, so this
 * doesn't silently fall outside the app's session handling.
 */

const VOICE_NOTES = '/voice-notes';

interface Cancellable {
  signal?: AbortSignal;
}

interface UploadVoiceNoteOptions extends Cancellable {
  noteId?: number;
  durationSeconds?: number;
  /** 0–1. Called from `xhr.upload.onprogress` — the one thing `fetch`
   * cannot report at all, which is the whole reason this bypasses
   * `httpClient`. */
  onProgress?: (fraction: number) => void;
}

function buildUploadUrl(noteId?: number, durationSeconds?: number): string {
  const params = new URLSearchParams();
  if (noteId !== undefined) params.set('noteId', String(noteId));
  if (durationSeconds !== undefined) params.set('durationSeconds', String(Math.round(durationSeconds)));
  const query = params.toString();
  return `${env.apiBaseUrl}${VOICE_NOTES}${query === '' ? '' : `?${query}`}`;
}

export const voiceService = {
  /**
   * `POST /voice-notes?noteId=&durationSeconds=`, `multipart/form-data`,
   * field `file` (§13's exact wording) — the two identifiers are QUERY
   * params, not form fields; `file` is the only multipart field.
   */
  async uploadVoiceNote(
    file: Blob,
    { noteId, durationSeconds, onProgress, signal }: UploadVoiceNoteOptions = {},
  ): Promise<VoiceNoteResponse> {
    const hooks = getAuthHooks();
    const authorization = hooks ? await hooks.getAuthorization() : null;

    const form = new FormData();
    form.append('file', file, 'recording');

    return new Promise<VoiceNoteResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildUploadUrl(noteId, durationSeconds));
      xhr.responseType = 'json';
      if (authorization !== null) xhr.setRequestHeader('Authorization', authorization);
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        onProgress(event.loaded / event.total);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response as VoiceNoteResponse);
        } else {
          // Same shape as httpClient's own 4xx/5xx classification — a
          // caller checking `isOffline`/`isForbidden`/etc. gets the same
          // answers regardless of which path the request took.
          reject(new ApiError({ kind: 'http', status: xhr.status, body: xhr.response as unknown }));
        }
      };
      xhr.onerror = () => {
        reject(new ApiError({ kind: 'network' }));
      };
      xhr.ontimeout = () => {
        reject(new ApiError({ kind: 'timeout' }));
      };
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new ApiError({ kind: 'aborted' }));
        });
      }

      xhr.send(form);
    });
  },

  getVoiceNote(id: number, { signal }: Cancellable = {}): Promise<VoiceNoteResponse> {
    return httpClient.get<VoiceNoteResponse>(`${VOICE_NOTES}/${String(id)}`, {
      ...(signal ? { signal } : {}),
    });
  },

  listVoiceNotes(
    page: number,
    size: number,
    { signal }: Cancellable = {},
  ): Promise<PagedResponse<VoiceNoteResponse>> {
    return httpClient.get<PagedResponse<VoiceNoteResponse>>(VOICE_NOTES, {
      query: { page, size },
      ...(signal ? { signal } : {}),
    });
  },

  /** `GET /voice-notes/by-note/{noteId}` — "list, unpaged" (§13). */
  listVoiceNotesByNote(noteId: number, { signal }: Cancellable = {}): Promise<VoiceNoteResponse[]> {
    return httpClient.get<VoiceNoteResponse[]>(`${VOICE_NOTES}/by-note/${String(noteId)}`, {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * `GET /voice-notes/{id}/download` — the FULL file, not `/stream`.
   *
   * `/stream` is the Range-capable endpoint (§6: "`ResourceRegion` ...
   * 206 Partial Content, so audio scrubbing works"), meant for a native
   * `<audio src="...">` to issue ranged requests directly — which needs an
   * `Authorization` header the `<audio>` element cannot send (G5).
   * Architecture doc §1.4's real fix is a service worker intercepting
   * those requests and attaching the header; that's Step 11 and doesn't
   * exist yet. Until it does, this app uses §1.4's explicitly-sanctioned
   * fallback: fetch the whole file as an authenticated `Blob` and hand the
   * browser an object URL. `<audio>` still seeks WITHIN the downloaded
   * blob (that's a browser feature, not a network one) — what's lost
   * until the service worker lands is not seeking, only start-to-play
   * latency on a large file, which is the acknowledged, revisited-in-
   * Step-11 trade-off §1.4 spells out.
   */
  async downloadVoiceNoteBlob(id: number, { signal }: Cancellable = {}): Promise<Blob> {
    const hooks = getAuthHooks();
    const authorization = hooks ? await hooks.getAuthorization() : null;

    const response = await fetch(`${env.apiBaseUrl}${VOICE_NOTES}/${String(id)}/download`, {
      headers: authorization !== null ? { Authorization: authorization } : {},
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw new ApiError({ kind: 'http', status: response.status, body: null });
    }

    return response.blob();
  },

  deleteVoiceNote(id: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${VOICE_NOTES}/${String(id)}`, {
      ...(signal ? { signal } : {}),
    });
  },
};

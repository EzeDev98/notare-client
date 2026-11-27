/** Server calls for uploading, streaming and deleting voice clips. */
import { getAuthHooks } from '@/lib/http/authHooks';
import { env } from '@/lib/config/env';
import { ApiError } from '@/lib/http/errors';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';
import type { VoiceNoteResponse } from '@/features/voice/types';

const VOICE_NOTES = '/voice-notes';

interface Cancellable {
  signal?: AbortSignal;
}

interface UploadVoiceNoteOptions extends Cancellable {
  noteId?: number;
  durationSeconds?: number;
  onProgress?: (fraction: number) => void;
}

function buildUploadUrl(noteId?: number, durationSeconds?: number): string {
  const params = new URLSearchParams();
  if (noteId !== undefined) params.set('noteId', String(noteId));
  if (durationSeconds !== undefined)
    params.set('durationSeconds', String(Math.round(durationSeconds)));
  const query = params.toString();
  return `${env.apiBaseUrl}${VOICE_NOTES}${query === '' ? '' : `?${query}`}`;
}

export const voiceService = {
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

  listVoiceNotesByNote(noteId: number, { signal }: Cancellable = {}): Promise<VoiceNoteResponse[]> {
    return httpClient.get<VoiceNoteResponse[]>(`${VOICE_NOTES}/by-note/${String(noteId)}`, {
      ...(signal ? { signal } : {}),
    });
  },

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

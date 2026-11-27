/** Server calls for transcriptions. */
import { httpClient } from '@/lib/http/client';
import type { TranscriptionResponse } from '@/features/voice/types';

interface Cancellable {
  signal?: AbortSignal;
}

export const transcriptionService = {
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

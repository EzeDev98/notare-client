/** Requests and follows the transcription of one clip. */
import { TRANSCRIPTION_POLL_MS } from '@/core/config/timings';
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import type { TranscriptRow } from '@/features/notes/local/transcriptRow';
import { transcriptionService } from '@/features/voice/api/transcriptionService';
import { isOffline } from '@/lib/http/errors';

type TranscriptStatus = TranscriptRow['status'];

const running = new Set<string>();

function save(clipId: string, status: TranscriptStatus, text: string | null = null): Promise<string> {
  return transcriptRepository.put({ clipId, status, text, updatedAt: Date.now() });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function requestTranscription(clipId: string): Promise<string> {
  return save(clipId, 'queued');
}

export async function driveTranscription(
  clipId: string,
  serverId: number,
): Promise<TranscriptStatus | null> {
  if (running.has(clipId)) return null;
  running.add(clipId);

  let marked = false;
  try {
    let result = await transcriptionService.submitTranscription(serverId);

    for (;;) {
      if (result.status === 'COMPLETED') {
        await save(clipId, 'done', result.transcript);
        return 'done';
      }
      if (result.status === 'FAILED') {
        await save(clipId, 'failed');
        return 'failed';
      }
      if (!marked) {
        marked = true;
        await save(clipId, 'transcribing');
      }
      await wait(TRANSCRIPTION_POLL_MS);
      result = await transcriptionService.getTranscription(serverId);
    }
  } catch (error) {
    if (isOffline(error)) {
      if (marked) await save(clipId, 'queued');
      return 'queued';
    }
    await save(clipId, 'failed');
    return 'failed';
  } finally {
    running.delete(clipId);
  }
}

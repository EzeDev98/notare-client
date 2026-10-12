import { TRANSCRIPTION_POLL_MS } from '@/core/config/timings';
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import type { TranscriptRow } from '@/features/notes/local/transcriptRow';
import { transcriptionService } from '@/features/voice/api/transcriptionService';
import { isOffline } from '@/lib/http/errors';

/*
 * Transcription of one clip (step 12h). The status lives in the transcripts
 * table. A request is first kept on the device as 'queued'. It is sent once the
 * clip has a server id and the device is online. The server then works on its
 * own, so the status survives closing the app.
 */

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

/** The person asked for a transcript (or pressed Retry). Sent when it can be. */
export function requestTranscription(clipId: string): Promise<string> {
  return save(clipId, 'queued');
}

/**
 * Sends a queued request and follows it to the end. Safe to call again for a
 * clip that is already being followed. Returns the final status, or null when
 * nothing was done.
 */
export async function driveTranscription(
  clipId: string,
  serverId: number,
): Promise<TranscriptStatus | null> {
  if (running.has(clipId)) return null;
  running.add(clipId);

  let marked = false;
  try {
    // Idempotent on the server: also right for a request made before a reload.
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
      // Back to waiting. Nothing is written if it never got going.
      if (marked) await save(clipId, 'queued');
      return 'queued';
    }
    await save(clipId, 'failed');
    return 'failed';
  } finally {
    running.delete(clipId);
  }
}

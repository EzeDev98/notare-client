import { useCallback, useRef, useState } from 'react';

import { CLIP_MAX_SECONDS } from '@/core/config/timings';

/**
 * "`MediaRecorder`: permissions, device selection, MIME negotiation
 * against the server allowlist" (architecture doc §2.6, 10A).
 *
 * MIME NEGOTIATION: "`MediaRecorder` in Chrome produces
 * `audio/webm;codecs=opus` by default — verify this is on the server
 * allowlist before Step 10, or the recorder must be configured to produce
 * a supported container. This is a likely early failure" (§2.6, verbatim).
 * NOTARE-SERVER.md §6 confirms the `.m4a`/MP4-AAC family is allowlisted
 * (multiple browser-reported names for the same container) but does not
 * state whether `audio/webm` is — `notare.voice.allowed-content-types` is
 * "now unset in properties so the Java default governs" (§13's properties
 * table), and that Java default isn't quoted anywhere in the docs I have.
 * CANDIDATES below is therefore ordered most-likely-to-least-likely
 * rather than confirmed, and `isTypeSupported` only tells us what THIS
 * BROWSER can encode — never what the SERVER will accept. Flagged per
 * this repo's own convention for an inferred/unverified assumption:
 * confirm the server's actual allowlist and reorder or trim this list
 * before relying on it in production.
 */
const CANDIDATE_MIME_TYPES = [
  'audio/mp4', // Safari's native output; matches the documented m4a/AAC allowlist most directly.
  'audio/webm;codecs=opus', // Chrome/Firefox default.
  'audio/webm',
  'audio/ogg;codecs=opus',
];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const candidate of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

/** The browser's answer for the microphone, or null where it cannot say (Safari, older browsers). */
async function microphonePermission(): Promise<PermissionState | null> {
  try {
    if (!('permissions' in navigator)) return null;
    return (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state;
  } catch {
    return null;
  }
}

export type RecorderStatus =
  | { state: 'idle' }
  | { state: 'requesting-permission' }
  | { state: 'permission-denied' }
  | { state: 'no-microphone' }
  | { state: 'unsupported' }
  | { state: 'recording'; startedAt: number; paused: boolean }
  | {
      state: 'stopped';
      blob: Blob;
      durationSeconds: number;
      mimeType: string;
      /** The recording stopped itself at CLIP_MAX_SECONDS. The clip is kept. */
      hitLimit: boolean;
    }
  | { state: 'error'; message: string };

/**
 * Owns the whole recording lifecycle: permission, device capture,
 * `MediaRecorder`, and the resulting `Blob` + measured duration. Does
 * NOT upload anything — that's `useUploadVoiceNote`, called separately by
 * whatever component holds the resulting blob, keeping "capture" and
 * "persist" as two steps a caller can retry independently (recording
 * again is cheap; re-uploading a blob that's already in hand should not
 * require re-recording).
 */
export function useMediaRecorderState() {
  const [status, setStatus] = useState<RecorderStatus>({ state: 'idle' });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  // Total time spent paused this recording, plus (while currently paused)
  // the still-open segment — both needed so `durationSeconds` on stop
  // reflects actual SPOKEN time, not wall-clock time including pauses.
  const pausedTotalMsRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);
  const limitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hitLimitRef = useRef(false);

  const stopTracks = useCallback(() => {
    if (limitTimerRef.current !== null) {
      clearInterval(limitTimerRef.current);
      limitTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === 'undefined'
    ) {
      setStatus({ state: 'unsupported' });
      return;
    }

    const mimeType = pickSupportedMimeType();
    if (mimeType === null) {
      setStatus({ state: 'unsupported' });
      return;
    }

    setStatus({ state: 'requesting-permission' });

    // Already blocked: say so now, instead of waiting for a prompt that cannot come (14f).
    if ((await microphonePermission()) === 'denied') {
      setStatus({ state: 'permission-denied' });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      // No microphone at all is its own state; any other refusal reads as blocked (14f).
      const name = error instanceof DOMException ? error.name : '';
      const missing = name === 'NotFoundError' || name === 'OverconstrainedError';
      setStatus({ state: missing ? 'no-microphone' : 'permission-denied' });
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    pausedTotalMsRef.current = 0;
    pausedAtRef.current = null;

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      // A stop CAN arrive while paused (discarding a paused recording, for
      // instance) — the still-open pause segment counts too, or a
      // discard-then-resume-math bug would under-subtract it.
      const openPauseMs = pausedAtRef.current === null ? 0 : Date.now() - pausedAtRef.current;
      const totalPausedMs = pausedTotalMsRef.current + openPauseMs;
      const durationSeconds = (Date.now() - startedAtRef.current - totalPausedMs) / 1000;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      const hitLimit = hitLimitRef.current;
      hitLimitRef.current = false;
      stopTracks();
      setStatus({ state: 'stopped', blob, durationSeconds, mimeType, hitLimit });
    };

    recorder.onerror = () => {
      stopTracks();
      setStatus({ state: 'error', message: 'The recording stopped unexpectedly.' });
    };

    startedAtRef.current = Date.now();
    hitLimitRef.current = false;
    recorder.start();
    setStatus({ state: 'recording', startedAt: startedAtRef.current, paused: false });

    // A recording stops itself at the limit and keeps what it has (step 8j).
    limitTimerRef.current = setInterval(() => {
      const openPauseMs = pausedAtRef.current === null ? 0 : Date.now() - pausedAtRef.current;
      const spokenMs = Date.now() - startedAtRef.current - pausedTotalMsRef.current - openPauseMs;
      if (spokenMs >= CLIP_MAX_SECONDS * 1000) {
        hitLimitRef.current = true;
        mediaRecorderRef.current?.stop();
      }
    }, 500);
  }, [stopTracks]);

  const stop = useCallback(() => {
    if (
      mediaRecorderRef.current?.state === 'recording' ||
      mediaRecorderRef.current?.state === 'paused'
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'recording') return;
    mediaRecorderRef.current.pause();
    pausedAtRef.current = Date.now();
    setStatus((prev) => (prev.state === 'recording' ? { ...prev, paused: true } : prev));
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'paused') return;
    mediaRecorderRef.current.resume();
    if (pausedAtRef.current !== null) {
      pausedTotalMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    setStatus((prev) => (prev.state === 'recording' ? { ...prev, paused: false } : prev));
  }, []);

  /** Discards a finished recording and returns to idle — "record again"
   * without re-requesting permission, since the browser already granted it
   * this session. */
  const reset = useCallback(() => {
    setStatus({ state: 'idle' });
  }, []);

  return { status, start, stop, pause, resume, reset };
}

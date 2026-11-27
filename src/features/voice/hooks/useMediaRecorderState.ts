/** Records audio from the microphone. */
import { useCallback, useRef, useState } from 'react';

import { CLIP_MAX_SECONDS } from '@/core/config/timings';

const CANDIDATE_MIME_TYPES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
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

async function microphonePermission(): Promise<PermissionState | null> {
  try {
    if (!('permissions' in navigator)) return null;
    return (await navigator.permissions.query({ name: 'microphone' })).state;
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
      hitLimit: boolean;
    }
  | { state: 'error'; message: string };

export function useMediaRecorderState() {
  const [status, setStatus] = useState<RecorderStatus>({ state: 'idle' });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
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

    if ((await microphonePermission()) === 'denied') {
      setStatus({ state: 'permission-denied' });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
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

  const reset = useCallback(() => {
    setStatus({ state: 'idle' });
  }, []);

  return { status, start, stop, pause, resume, reset };
}

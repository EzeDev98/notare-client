import { useEffect, useRef, useState } from 'react';

import { CLIP_MAX_SECONDS } from '@/core/config/timings';
import { useToast } from '@/design-system/ui';
import { VoiceBlock, type VoiceState } from '@/design-system/ui/VoiceBlock/VoiceBlock';
import { isQuotaError, setStorageFull } from '@/features/notes/status/storageFull';
import { useMediaRecorderState } from '@/features/voice/hooks/useMediaRecorderState';
import { formatClock } from '@/features/voice/player';
import { saveClip } from '@/features/voice/saveClip';

import { endRecording } from './recordingIds';

interface RecordingBlockProps {
  recordingId: string;
  noteId: string;
  /** The clip is safely stored; the block becomes a normal clip. */
  onSaved: (clipId: string) => void;
  onRemove: () => void;
}

/**
 * The block while a clip is being made: asking for the microphone, recording,
 * then saving on this device. Starts recording as soon as it appears.
 */
export function RecordingBlock({ recordingId, noteId, onSaved, onRemove }: RecordingBlockProps) {
  const recorder = useMediaRecorderState();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const startedRef = useRef(false);
  const handledRef = useRef(false);

  const { start, stop, status } = recorder;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  // Leaving the note must not leave the microphone open.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (status.state !== 'recording') return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => {
      clearInterval(timer);
    };
  }, [status.state]);

  useEffect(() => {
    if (status.state !== 'stopped' || handledRef.current) return;
    handledRef.current = true;
    const { blob, durationSeconds, mimeType, hitLimit } = status;

    void (async () => {
      try {
        const clipId = await saveClip(noteId, blob, durationSeconds, mimeType);
        if (hitLimit) {
          toast(`Recording stopped at ${String(CLIP_MAX_SECONDS / 60)} minutes. Your clip is saved.`);
        }
        onSaved(clipId);
        endRecording(recordingId);
      } catch (error) {
        if (isQuotaError(error)) setStorageFull(true);
        endRecording(recordingId);
        toast('Could not save the clip. This device is out of room.', { tone: 'error' });
        onRemove();
      }
    })();
  }, [status, noteId, recordingId, onSaved, onRemove, toast]);

  const tryAgain = (): void => {
    startedRef.current = true;
    void start();
  };
  const remove = (): void => {
    endRecording(recordingId);
    onRemove();
  };

  let state: VoiceState;
  switch (status.state) {
    case 'recording':
      state = 'recording';
      break;
    case 'stopped':
      state = 'saving';
      break;
    case 'permission-denied':
      state = 'mic-blocked';
      break;
    case 'unsupported':
    case 'error':
      state = 'no-mic';
      break;
    default:
      state = 'permission-waiting';
  }

  const elapsed = status.state === 'recording' ? (now - status.startedAt) / 1000 : 0;

  return <VoiceBlock state={state} time={formatClock(elapsed)} onStop={stop} onTryAgain={tryAgain} onRemove={remove} />;
}

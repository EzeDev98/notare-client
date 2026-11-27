/** A voice clip being recorded inside a note. */
import { useEffect, useRef, useState } from 'react';

import { CLIP_MAX_SECONDS } from '@/core/config/timings';
import { Button, Overlay, useToast } from '@/design-system/ui';
import { VoiceBlock, type VoiceState } from '@/design-system/ui/VoiceBlock/VoiceBlock';
import { EDITOR_COPY } from '@/features/editor/editorContent';
import { isQuotaError, setStorageFull } from '@/features/notes/status/storageFull';
import { useMediaRecorderState } from '@/features/voice/hooks/useMediaRecorderState';
import { formatClock } from '@/features/voice/player';
import { saveClip } from '@/features/voice/saveClip';

import { endRecording } from './recordingIds';

interface RecordingBlockProps {
  recordingId: string;
  noteId: string;
  onSaved: (clipId: string) => void;
  onRemove: () => void;
}

export function RecordingBlock({ recordingId, noteId, onSaved, onRemove }: RecordingBlockProps) {
  const recorder = useMediaRecorderState();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const startedRef = useRef(false);
  const handledRef = useRef(false);
  const retriedRef = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { start, stop, status } = recorder;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

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

  useEffect(() => {
    if (status.state === 'permission-denied' && retriedRef.current) setHelpOpen(true);
  }, [status.state]);

  const tryAgain = (): void => {
    startedRef.current = true;
    retriedRef.current = true;
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
    case 'no-microphone':
    case 'unsupported':
    case 'error':
      state = 'no-mic';
      break;
    default:
      state = 'permission-waiting';
  }

  const elapsed = status.state === 'recording' ? (now - status.startedAt) / 1000 : 0;

  const closeHelp = (): void => {
    setHelpOpen(false);
  };

  return (
    <>
      <VoiceBlock state={state} time={formatClock(elapsed)} onStop={stop} onTryAgain={tryAgain} onRemove={remove} />
      <Overlay
        open={helpOpen}
        onClose={closeHelp}
        title={EDITOR_COPY.mic.helpTitle}
        footer={
          <Button variant="primary" onClick={closeHelp}>
            {EDITOR_COPY.mic.gotIt}
          </Button>
        }
      >
        <p>{EDITOR_COPY.mic.help}</p>
      </Overlay>
    </>
  );
}

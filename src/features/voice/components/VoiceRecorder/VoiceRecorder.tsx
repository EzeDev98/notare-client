import { useEffect, useState } from 'react';

import { useMediaRecorderState } from '@/features/voice/hooks/useMediaRecorderState';
import { useUploadVoiceNote } from '@/features/voice/hooks/useVoiceNoteMutations';
import { Button } from '@/design-system/components/Button/Button';
import './VoiceRecorder.css';

interface VoiceRecorderProps {
  /** The note this recording will be linked to, once uploaded. */
  noteId: number;
  onUploaded?: () => void;
}

function formatElapsed(seconds: number): string {
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins)}:${String(secs).padStart(2, '0')}`;
}

/**
 * 10A + 10B: capture via `MediaRecorder`, then upload with progress.
 * Two separate steps on purpose (see `useMediaRecorderState`'s own doc
 * comment) — a failed upload offers "Try again" against the SAME blob,
 * not "record again".
 */
export function VoiceRecorder({ noteId, onUploaded }: VoiceRecorderProps) {
  const recorder = useMediaRecorderState();
  const upload = useUploadVoiceNote();
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // A visible ticking timer while recording — `startedAt` alone doesn't
  // re-render anything, so this effect is what makes the clock move.
  useEffect(() => {
    if (recorder.status.state !== 'recording') return;
    const startedAt = recorder.status.startedAt;
    const interval = setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000);
    }, 250);
    return () => {
      clearInterval(interval);
    };
  }, [recorder.status]);

  function handleUpload() {
    if (recorder.status.state !== 'stopped') return;
    const { blob, durationSeconds } = recorder.status;
    setProgress(0);
    upload.mutate(
      {
        file: blob,
        noteId,
        durationSeconds,
        onProgress: setProgress,
      },
      {
        onSuccess: () => {
          recorder.reset();
          setElapsed(0);
          onUploaded?.();
        },
      },
    );
  }

  if (recorder.status.state === 'unsupported') {
    return (
      <p className="voice-recorder__message" role="alert">
        Recording isn&apos;t supported in this browser.
      </p>
    );
  }

  if (recorder.status.state === 'permission-denied') {
    return (
      <div className="voice-recorder__message" role="alert">
        <p>Notare needs microphone access to record a voice note.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void recorder.start();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (recorder.status.state === 'error') {
    return (
      <div className="voice-recorder__message" role="alert">
        <p>{recorder.status.message}</p>
        <Button variant="secondary" size="sm" onClick={recorder.reset}>
          Dismiss
        </Button>
      </div>
    );
  }

  if (recorder.status.state === 'recording') {
    return (
      <div className="voice-recorder voice-recorder--active">
        <span className="voice-recorder__dot" aria-hidden="true" />
        <span className="voice-recorder__timer" role="status">
          Recording — {formatElapsed(elapsed)}
        </span>
        <Button variant="danger" size="sm" onClick={recorder.stop}>
          Stop
        </Button>
      </div>
    );
  }

  if (recorder.status.state === 'stopped') {
    return (
      <div className="voice-recorder">
        <span className="voice-recorder__timer">
          Recorded {formatElapsed(recorder.status.durationSeconds)}
        </span>

        {upload.isPending ? (
          <span className="voice-recorder__progress" role="status">
            Uploading… {Math.round(progress * 100)}%
          </span>
        ) : (
          <div className="voice-recorder__actions">
            <Button variant="secondary" size="sm" onClick={recorder.reset}>
              Discard
            </Button>
            <Button variant="primary" size="sm" onClick={handleUpload}>
              Save
            </Button>
          </div>
        )}

        {upload.isError ? (
          <p className="voice-recorder__message" role="alert">
            Couldn&apos;t upload. Check your connection and try again — the
            recording is still here.
          </p>
        ) : null}
      </div>
    );
  }

  // idle / requesting-permission
  return (
    <div className="voice-recorder">
      <Button
        variant="secondary"
        size="sm"
        loading={recorder.status.state === 'requesting-permission'}
        onClick={() => {
          void recorder.start();
        }}
      >
        Record a voice note
      </Button>
    </div>
  );
}

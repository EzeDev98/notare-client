import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Send, Trash2 } from 'lucide-react';

import { useMediaRecorderState } from '@/features/voice/hooks/useMediaRecorderState';
import { useUploadVoiceNote } from '@/features/voice/hooks/useVoiceNoteMutations';
import { Button } from '@/design-system/components/Button/Button';
import './VoiceRecorder.css';

interface VoiceRecorderProps {
  /** The note this recording will be linked to, once uploaded. */
  noteId: number;
  onUploaded?: () => void;
}

/** Purely decorative — no live amplitude analysis. Enough bars that the
 * strip reads as a continuous waveform rather than a few dashes, few
 * enough that staggering their delays by hand (below) stays readable. */
const WAVEFORM_BAR_COUNT = 64;
const WAVEFORM_BARS = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => index);

function formatElapsed(seconds: number): string {
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins)}:${String(secs).padStart(2, '0')}`;
}

/**
 * The animated strip that fills the space between trash and send while
 * recording — THE demarcator the request asked for, playing the same role
 * WhatsApp's own waveform plays in its recording bar. `paused` freezes it
 * via animation-play-state rather than unmounting it, so resuming picks
 * up mid-animation instead of restarting.
 */
function Waveform({ paused }: { paused: boolean }) {
  return (
    <div className="voice-recorder__wave" aria-hidden="true">
      {WAVEFORM_BARS.map((index) => (
        <span
          key={index}
          className="voice-recorder__wave-bar"
          style={{
            animationDelay: `${String((index % 9) * 80)}ms`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      ))}
    </div>
  );
}

/**
 * 10A + 10B: capture via `MediaRecorder`, then upload with progress.
 * Two separate steps on purpose (see `useMediaRecorderState`'s own doc
 * comment) — a failed upload offers "Try again" against the SAME blob,
 * not "record again".
 *
 * ONE DOCK ELEMENT across every state (idle/recording/stopped), not a
 * different container per state — that's what makes the WhatsApp-style
 * "unfold" actually animate. Swapping to a differently-classed div per
 * state would remount it on every transition, and a remounted element
 * cannot transition its own width: it simply appears at its new size.
 * Keeping one persistent `.voice-recorder__dock` and only toggling its
 * modifier class + children lets `inline-size` transition smoothly from
 * the idle mic's 56px to the active bar's 80%.
 */
export function VoiceRecorder({ noteId, onUploaded }: VoiceRecorderProps) {
  const recorder = useMediaRecorderState();
  const upload = useUploadVoiceNote();
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const discardOnStopRef = useRef(false);
  // Set when "send" is clicked WHILE recording — see the effect below and
  // this file's own top-comment update. MediaRecorder.stop() is
  // asynchronous (the blob isn't ready until its `onstop` fires, tracked
  // in useMediaRecorderState), so "stop, then upload" can't happen in one
  // synchronous handler — this flag is what carries the person's intent
  // across that async gap.
  const uploadOnStopRef = useRef(false);

  function startUpload(blob: Blob, durationSeconds: number) {
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

  useEffect(() => {
    if (recorder.status.state !== 'stopped') return;

    if (discardOnStopRef.current) {
      discardOnStopRef.current = false;
      recorder.reset();
      return;
    }

    /*
     * ONE click to send, not two — clicking send WHILE recording used to
     * only call recorder.stop(), landing on a SEPARATE "stopped" screen
     * that still needed its own send click to actually upload. That
     * second click was never a deliberate confirmation step, just a
     * side effect of stop and upload being two different calls; nothing
     * about it needed the person's input, so it doesn't ask for it
     * anymore. Fires the SAME upload the manual retry button (below)
     * uses, right as the stopped blob becomes available.
     */
    if (uploadOnStopRef.current) {
      uploadOnStopRef.current = false;
      startUpload(recorder.status.blob, recorder.status.durationSeconds);
    }
    // startUpload is a plain function recreated each render, not a stable
    // dependency — including it would re-run this effect on every render
    // for no reason. Only the recorder's OWN state transition should
    // trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder]);

  function handleDiscardWhileRecording() {
    discardOnStopRef.current = true;
    recorder.stop();
  }

  function handleSendWhileRecording() {
    uploadOnStopRef.current = true;
    recorder.stop();
  }

  // A simple running counter, not `Date.now() - startedAt` — that wall-clock
  // formula has no way to account for time spent paused without also
  // duplicating useMediaRecorderState's own pause-tracking here. Ticking a
  // counter that simply stops while paused (and stops again, permanently,
  // once stopped) gets the same visible behaviour for a fraction of the
  // bookkeeping; the precise, pause-aware duration used for the upload
  // itself still comes from the hook.
  useEffect(() => {
    if (recorder.status.state !== 'recording' || recorder.status.paused) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 0.25);
    }, 250);
    return () => {
      clearInterval(interval);
    };
  }, [recorder.status]);

  /*
   * The manual "send" button in the STOPPED view (below) — reachable now
   * only via a failed upload's retry, since the happy path
   * (handleSendWhileRecording -> the effect above) auto-uploads and
   * resets before this screen would ever be seen. Kept as its own named
   * handler rather than inlining startUpload directly in the JSX: it
   * still needs the `state !== 'stopped'` guard startUpload itself
   * doesn't have (that function trusts its caller to already be in the
   * right state, which the effect above guarantees and a raw button
   * click does not).
   */
  function handleUpload() {
    if (recorder.status.state !== 'stopped') return;
    startUpload(recorder.status.blob, recorder.status.durationSeconds);
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

  const isActive = recorder.status.state === 'recording' || recorder.status.state === 'stopped';

  return (
    <div className={`voice-recorder__dock${isActive ? ' voice-recorder__dock--active' : ''}`}>
      {recorder.status.state === 'recording' ? (
        <>
          <button
            type="button"
            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={handleDiscardWhileRecording}
            aria-label="Discard recording"
          >
            <Trash2 aria-hidden="true" strokeWidth={1.75} color="var(--color-danger)" />
          </button>

          {/*
            THE demarcator between trash and send — the waveform (paused
            with the recording) plus a visible, ticking timer, both inside
            one role="status" region so a screen reader hears the same
            live announcement sighted users see, rather than a separate
            visually-hidden node duplicating it.
          */}
          <div className="voice-recorder__bar-status" role="status">
            <Waveform paused={recorder.status.paused} />
            <span className="voice-recorder__timer">{formatElapsed(elapsed)}</span>
          </div>

          <button
            type="button"
            className="voice-recorder__bar-btn"
            onClick={recorder.status.paused ? recorder.resume : recorder.pause}
            aria-label={recorder.status.paused ? 'Resume recording' : 'Pause recording'}
          >
            {recorder.status.paused ? (
              <Play aria-hidden="true" strokeWidth={1.75} />
            ) : (
              <Pause aria-hidden="true" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            className="voice-recorder__bar-btn voice-recorder__bar-btn--send"
            onClick={handleSendWhileRecording}
            aria-label="Save recording"
          >
            <Send aria-hidden="true" strokeWidth={1.75} color="var(--color-text-on-accent)" />
          </button>
        </>
      ) : null}

      {recorder.status.state === 'stopped' ? (
        <>
          <button
            type="button"
            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={recorder.reset}
            disabled={upload.isPending}
            aria-label="Discard recording"
          >
            <Trash2 aria-hidden="true" strokeWidth={1.75} color="var(--color-danger)" />
          </button>

          <div className="voice-recorder__bar-status" role="status">
            {upload.isPending ? <span className="ds-visually-hidden">Uploading, </span> : null}
            <span className="voice-recorder__timer">
              {upload.isPending
                ? `${String(Math.round(progress * 100))}%`
                : formatElapsed(recorder.status.durationSeconds)}
            </span>
          </div>

          <button
            type="button"
            className="voice-recorder__bar-btn voice-recorder__bar-btn--send"
            onClick={handleUpload}
            disabled={upload.isPending}
            aria-label="Save recording"
          >
            <Send aria-hidden="true" strokeWidth={1.75} color="var(--color-text-on-accent)" />
          </button>

          {upload.isError ? (
            <p className="voice-recorder__message" role="alert">
              Couldn&apos;t upload. Check your connection and try again — the recording is still
              here.
            </p>
          ) : null}
        </>
      ) : null}

      {recorder.status.state === 'idle' || recorder.status.state === 'requesting-permission' ? (
        <button
          type="button"
          className="voice-recorder__bar-btn voice-recorder__bar-btn--mic"
          disabled={recorder.status.state === 'requesting-permission'}
          onClick={() => {
            setElapsed(0);
            void recorder.start();
          }}
          aria-label="Record a voice note"
        >
          <Mic aria-hidden="true" strokeWidth={1.75} color="var(--color-text-on-accent)" />
        </button>
      ) : null}
    </div>
  );
}

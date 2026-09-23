import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MicrophoneIcon, PaperPlaneIcon, PauseIcon, PlayIcon, TrashIcon } from '@patternfly/react-icons';

import { useMediaRecorderState } from '@/features/voice/hooks/useMediaRecorderState';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import './VoiceRecorder.css';

/**
 * The shape `VoiceRecorder` needs from an upload mutation — deliberately
 * NOT `UseMutationResult` itself (React Query's real type carries a lot
 * VoiceRecorder never touches). Both call sites' mutation hooks already
 * satisfy this structurally: `useUploadVoiceNote` (the owner's own
 * recordings, wrapped in `NoteDetailPage` to fix `noteId` via closure — see
 * that file) and `useUploadAttachedVoiceNote` (a shared note's recorder,
 * `noteId` fixed per-hook-instance already).
 *
 * This is what actually decouples VoiceRecorder from note OWNERSHIP: it no
 * longer knows or cares whether the note it's recording onto belongs to the
 * current user or was shared to them — that decision lives entirely in
 * which mutation hook the caller passes in.
 */
export interface VoiceUploadHandle {
  mutate: (
    variables: { file: Blob; durationSeconds?: number; onProgress?: (fraction: number) => void },
    options?: { onSuccess?: () => void },
  ) => void;
  isPending: boolean;
  isError: boolean;
}

interface VoiceRecorderProps {
  upload: VoiceUploadHandle;
  /**
   * The note currently on screen. NOT just a label — this is what makes a
   * recording belong to the note it was STARTED on rather than whichever
   * note happens to be open when the person hits send.
   *
   * Why this is needed at all: NoteDetailPage/SharedNoteView are never
   * remounted when the person switches notes (see NoteEditorHost's own
   * note on why — the editor stays mounted across note switches), so this
   * component and its `useMediaRecorderState` instance survive a note
   * switch too. Without tracking which noteId owns the in-flight
   * recording, `upload` (rebuilt fresh each render from whatever note is
   * CURRENTLY open) would silently attach a recording to the wrong note —
   * exactly the bug this prop exists to close.
   */
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
export function VoiceRecorder({ upload, noteId, onUploaded }: VoiceRecorderProps) {
  const recorder = useMediaRecorderState();
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // Which trash button opened the confirmation, so the single Modal below
  // knows which underlying discard to actually run once confirmed — the
  // two trash buttons (recording vs. stopped) discard through different
  // paths (stop-then-reset vs. an immediate reset), same as
  // handleDiscardWhileRecording/recorder.reset did before this modal
  // existed. null means the modal is closed.
  const [confirmingDiscard, setConfirmingDiscard] = useState<'recording' | 'stopped' | null>(
    null,
  );

  /*
   * The note that started the CURRENT recording — null whenever there is
   * none in flight. This is the fix for "a vn must be tied to a note":
   * without it, this component (which persists across note switches, see
   * the `noteId` prop's own doc comment) has no way to tell "the note I'm
   * looking at right now" apart from "the note I'm actually recording
   * for".
   */
  const [recordingOwnerNoteId, setRecordingOwnerNoteId] = useState<number | null>(null);
  const isForeignRecording = recordingOwnerNoteId !== null && recordingOwnerNoteId !== noteId;

  const discardOnStopRef = useRef(false);
  // Set when "send" is clicked WHILE recording — see the effect below and
  // this file's own top-comment update. MediaRecorder.stop() is
  // asynchronous (the blob isn't ready until its `onstop` fires, tracked
  // in useMediaRecorderState), so "stop, then upload" can't happen in one
  // synchronous handler — this flag is what carries the person's intent
  // across that async gap.
  const uploadOnStopRef = useRef(false);

  /*
   * The only place `recorder.reset()` should be called — pairs it with
   * clearing ownership so a resolved recording (sent OR discarded) frees
   * this component back up for whichever note is on screen next. Calling
   * `recorder.reset()` directly anywhere else would leave
   * `recordingOwnerNoteId` stale, permanently locking the mic to a note
   * that no longer has anything in flight.
   */
  function resetRecording() {
    recorder.reset();
    setRecordingOwnerNoteId(null);
  }

  function startUpload(blob: Blob, durationSeconds: number) {
    setProgress(0);
    upload.mutate(
      {
        file: blob,
        durationSeconds,
        onProgress: setProgress,
      },
      {
        onSuccess: () => {
          resetRecording();
          setElapsed(0);
          onUploaded?.();
        },
      },
    );
  }

  /*
   * Auto-pause on the way out, WhatsApp-style: leaving the note that owns
   * the in-flight recording pauses it rather than letting it keep
   * capturing audio for a note the person isn't even looking at. Coming
   * back later shows it exactly as left — still paused, still there,
   * still tied to the right note — rather than continuing unattended or,
   * before this fix, ending up attached to whatever note happened to be
   * open at send time.
   *
   * Keyed on `noteId` alone: this must fire on every note switch, not on
   * every recorder status change (an ordinary pause/resume click while
   * STAYING on the same note must not re-trigger it).
   */
  const previousNoteIdRef = useRef(noteId);
  useEffect(() => {
    if (previousNoteIdRef.current === noteId) return;
    const leftNoteId = previousNoteIdRef.current;
    previousNoteIdRef.current = noteId;

    if (
      recordingOwnerNoteId === leftNoteId &&
      recorder.status.state === 'recording' &&
      !recorder.status.paused
    ) {
      recorder.pause();
    }
    // recorder is stable (useMediaRecorderState never returns a new
    // object identity worth re-running this for); recordingOwnerNoteId and
    // recorder.status are read, not depended on, the same way the elapsed-
    // timer effect below already does — only the NOTE SWITCH should ever
    // fire this, not a status change on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  /*
   * The dock element itself — see the transition-suppression effect right
   * below for why this needs a direct handle rather than going through
   * React state/class alone.
   */
  const dockRef = useRef<HTMLDivElement>(null);

  /*
   * Suppresses the dock's own inline-size transition for a NOTE SWITCH
   * specifically — not for a real state change on the note currently on
   * screen.
   *
   * Without this: `isForeignRecording` flips true/false exactly like a
   * genuine start/stop does (both toggle `isActive`), so navigating away
   * from a recording note "folds" the dock shut, and navigating back
   * "unfolds" it again — the CSS transition plays both times. WhatsApp's
   * bar never animates open or closed just because you switched chats; it
   * is simply already in whatever state it's in the instant you arrive.
   * Pressing the mic, sending, or discarding on the note you're actually
   * looking at should still animate — only a `noteId` change should not.
   *
   * useLayoutEffect (not useEffect) because it must run — and finish —
   * before the browser paints the new noteId's render, in time to disable
   * the transition before that first paint rather than after it.
   */
  const previousNoteIdForTransitionRef = useRef(noteId);
  useLayoutEffect(() => {
    if (previousNoteIdForTransitionRef.current === noteId) return;
    previousNoteIdForTransitionRef.current = noteId;

    const dock = dockRef.current;
    if (!dock) return;

    dock.style.transition = 'none';
    // Forces the browser to apply the transition:none style immediately —
    // without reading a layout property here, removing the override on
    // the next line can get batched into the same frame and the browser
    // transitions anyway.
    void dock.offsetWidth;
    dock.style.transition = '';
  }, [noteId]);

  useEffect(() => {
    if (recorder.status.state !== 'stopped') return;

    if (discardOnStopRef.current) {
      discardOnStopRef.current = false;
      resetRecording();
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

  // Runs the discard the trash button actually asked for, once the person
  // has confirmed it in the Modal — see confirmingDiscard's own comment
  // above for why there are two different underlying actions here.
  function confirmDiscard() {
    if (confirmingDiscard === 'recording') {
      handleDiscardWhileRecording();
    } else if (confirmingDiscard === 'stopped') {
      resetRecording();
    }
    setConfirmingDiscard(null);
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

  /*
   * Every branch below that reflects the recorder's REAL state (as opposed
   * to the idle mic button, which is the one thing every note is allowed
   * to show) is additionally gated on `!isForeignRecording` — otherwise a
   * note that isn't recording anything would render another note's
   * unsupported/permission/error/recording/stopped state as if it were
   * its own.
   */
  if (!isForeignRecording && recorder.status.state === 'unsupported') {
    return (
      <p className="voice-recorder__message" role="alert">
        Recording isn&apos;t supported in this browser.
      </p>
    );
  }

  if (!isForeignRecording && recorder.status.state === 'permission-denied') {
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

  if (!isForeignRecording && recorder.status.state === 'error') {
    return (
      <div className="voice-recorder__message" role="alert">
        <p>{recorder.status.message}</p>
        <Button variant="secondary" size="sm" onClick={resetRecording}>
          Dismiss
        </Button>
      </div>
    );
  }

  const isActive =
    !isForeignRecording && (recorder.status.state === 'recording' || recorder.status.state === 'stopped');

  return (
    <div
      ref={dockRef}
      className={`voice-recorder__dock${isActive ? ' voice-recorder__dock--active' : ''}`}
    >
      {!isForeignRecording && recorder.status.state === 'recording' ? (
        <>
          <button
            type="button"
            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={() => {
              setConfirmingDiscard('recording');
            }}
            aria-label="Discard recording"
          >
            <TrashIcon aria-hidden="true" color="var(--color-danger)" />
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
              <PlayIcon aria-hidden="true" />
            ) : (
              <PauseIcon aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="voice-recorder__bar-btn voice-recorder__bar-btn--send"
            onClick={handleSendWhileRecording}
            aria-label="Save recording"
          >
            <PaperPlaneIcon aria-hidden="true" color="var(--color-text-on-accent)" />
          </button>
        </>
      ) : null}

      {!isForeignRecording && recorder.status.state === 'stopped' ? (
        <>
          <button
            type="button"
            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={() => {
              setConfirmingDiscard('stopped');
            }}
            disabled={upload.isPending}
            aria-label="Discard recording"
          >
            <TrashIcon aria-hidden="true" color="var(--color-danger)" />
          </button>

          <div className="voice-recorder__bar-status" role="status">
            {upload.isPending ? <span className="pf-v6-screen-reader">Uploading, </span> : null}
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
            <PaperPlaneIcon aria-hidden="true" color="var(--color-text-on-accent)" />
          </button>

          {upload.isError ? (
            <p className="voice-recorder__message" role="alert">
              Couldn&apos;t upload. Check your connection and try again — the recording is still
              here.
            </p>
          ) : null}
        </>
      ) : null}

      {isForeignRecording ||
      recorder.status.state === 'idle' ||
      recorder.status.state === 'requesting-permission' ? (
        <button
          type="button"
          className="voice-recorder__bar-btn voice-recorder__bar-btn--mic"
          disabled={isForeignRecording || recorder.status.state === 'requesting-permission'}
          onClick={() => {
            if (isForeignRecording) return;
            setElapsed(0);
            setRecordingOwnerNoteId(noteId);
            void recorder.start();
          }}
          aria-label={
            isForeignRecording
              ? 'Finish the recording on your other note first'
              : 'Record a voice note'
          }
        >
          <MicrophoneIcon aria-hidden="true" color="var(--color-text-on-accent)" />
        </button>
      ) : null}

      {confirmingDiscard ? (
        <Modal
          icon={<MicrophoneIcon aria-hidden="true" />}
          description="Discard this recording? It hasn't been saved yet — this can't be undone."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setConfirmingDiscard(null);
            },
          }}
          primaryAction={{
            label: 'Discard',
            onClick: confirmDiscard,
          }}
          onClose={() => {
            setConfirmingDiscard(null);
          }}
        />
      ) : null}
    </div>
  );
}
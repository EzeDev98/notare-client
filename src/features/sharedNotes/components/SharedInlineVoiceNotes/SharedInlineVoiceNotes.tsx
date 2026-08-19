import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { useAttachedAudioBlob } from '@/features/sharedNotes/hooks/useAttachedAudioBlob';
import type { VoiceNoteResponse } from '@/features/voice/types';
import '@/features/voice/components/InlineVoiceNote/InlineVoiceNote.css';

const WAVEFORM_BAR_COUNT = 32;
const WAVEFORM_BARS = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => index);

interface SharedInlineVoiceNotesProps {
  noteId: number;
  voiceNotes: VoiceNoteResponse[];
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '0:00';
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins)}:${String(secs).padStart(2, '0')}`;
}

function formatRecordedTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * The shared-note counterpart to `features/voice/components/InlineVoiceNote`
 * — same bubble/waveform/playback markup and CSS (imported directly, no new
 * class names), reused per the brief's own instruction not to duplicate
 * working pieces unnecessarily. Two deliberate differences from the owner
 * version:
 *
 * 1. Audio comes from `useAttachedAudioBlob(noteId, voiceNoteId)`
 *    (note-grant-gated), not `useAudioBlob(voiceNoteId)` (ownership-gated) —
 *    the recipient does not own most of what's attached here.
 * 2. NO "Transcribe" link. That link points at `/voice/:id`, the OWNER-ONLY
 *    transcription page — a recipient viewing an attachment they don't
 *    personally own (the note owner's own recordings, or another
 *    collaborator's) would 403/404 there. A recipient's OWN recording (one
 *    they made themselves via this note's `VoiceRecorder`) IS reachable at
 *    `/voice/:id`, but branching this component per-item ownership just to
 *    conditionally show one link is not worth the complexity yet — omitted
 *    uniformly for now, flagged as a reasonable follow-up rather than solved
 *    here.
 */
export function SharedInlineVoiceNotes({ noteId, voiceNotes }: SharedInlineVoiceNotesProps) {
  if (voiceNotes.length === 0) return null;

  return (
    <div className="inline-voice-notes" aria-label="Voice notes in this note">
      {voiceNotes.map((voiceNote) => (
        <SharedInlineVoiceNote key={voiceNote.id} noteId={noteId} voiceNote={voiceNote} />
      ))}
    </div>
  );
}

function SharedInlineVoiceNote({
  noteId,
  voiceNote,
}: {
  noteId: number;
  voiceNote: VoiceNoteResponse;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const blob = useAttachedAudioBlob(noteId, voiceNote.id);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handlePlay = () => {
      setPlaying(true);
    };
    const handlePause = () => {
      setPlaying(false);
    };
    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [blob.status === 'ready' ? blob.url : null]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || blob.status !== 'ready') return;
    if (audio.paused) {
      void audio.play().catch(() => {
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }

  const duration = voiceNote.durationSeconds ?? 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const recordedTime = formatRecordedTime(String(voiceNote.createdAt));

  return (
    <article className="inline-voice-note">
      <div className="inline-voice-note__bubble">
        <div className="inline-voice-note__main">
          <div className="inline-voice-note__avatar" aria-hidden="true">
            🎙
          </div>

          <button
            type="button"
            className="inline-voice-note__play"
            onClick={togglePlayback}
            disabled={blob.status !== 'ready'}
            aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          >
            {playing ? (
              <Pause aria-hidden="true" strokeWidth={2} />
            ) : (
              <Play aria-hidden="true" strokeWidth={2} />
            )}
          </button>

          <div className="inline-voice-note__wave" aria-hidden="true">
            {WAVEFORM_BARS.map((index) => (
              <span
                key={index}
                className={`inline-voice-note__wave-bar${
                  index / (WAVEFORM_BAR_COUNT - 1) <= progress ? ' is-played' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="inline-voice-note__meta">
          <span className="inline-voice-note__duration">
            {playing ? formatDuration(currentTime) : formatDuration(voiceNote.durationSeconds)}
          </span>

          {recordedTime ? (
            <time className="inline-voice-note__recorded-time" dateTime={String(voiceNote.createdAt)}>
              {recordedTime}
            </time>
          ) : null}
        </div>
      </div>

      {blob.status === 'error' ? (
        <span className="inline-voice-note__error" role="status">
          Couldn&apos;t load recording.
        </span>
      ) : null}

      {blob.status === 'ready' ? (
        <audio ref={audioRef} src={blob.url} preload="metadata" className="inline-voice-note__audio" />
      ) : null}
    </article>
  );
}

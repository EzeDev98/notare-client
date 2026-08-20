import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Pause, Play } from 'lucide-react';

import { useAudioBlob } from '@/features/voice/hooks/useAudioBlob';
import type { VoiceNoteResponse } from '@/features/voice/types';
import './InlineVoiceNote.css';

const WAVEFORM_BAR_COUNT = 32;
const WAVEFORM_BARS = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => index);

interface InlineVoiceNotesProps {
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

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Compact in-note representation of saved voice notes.
 *
 * This is NOT another upload or another voice-note record.
 * It renders the same server-side voice note that already exists.
 *
 * The full /voice/:id page remains the durable destination for:
 * playback, transcription, deletion and other voice-note actions.
 */
export function InlineVoiceNotes({ voiceNotes }: InlineVoiceNotesProps) {
  if (voiceNotes.length === 0) return null;

  return (
    <div className="inline-voice-notes" aria-label="Voice notes in this note">
      {voiceNotes.map((voiceNote) => (
        <InlineVoiceNote key={voiceNote.id} voiceNote={voiceNote} />
      ))}
    </div>
  );
}

function InlineVoiceNote({ voiceNote }: { voiceNote: VoiceNoteResponse }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const blob = useAudioBlob(voiceNote.id);

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
          <div
            className="inline-voice-note__avatar"
            aria-hidden="true"
          >
            MJ
          </div>

          <button
            type="button"
            className="inline-voice-note__play"
            onClick={togglePlayback}
            disabled={blob.status !== 'ready'}
            aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          >
            {playing ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
          </button>

          <div className="inline-voice-note__wave" aria-hidden="true">
            {WAVEFORM_BARS.map((index) => (
              <span
                key={index}
                className={`inline-voice-note__wave-bar${
                  index / (WAVEFORM_BAR_COUNT - 1) <= progress
                    ? ' is-played'
                    : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="inline-voice-note__meta">
          <span className="inline-voice-note__duration">
            {playing
              ? formatDuration(currentTime)
              : formatDuration(voiceNote.durationSeconds)}
          </span>

          {recordedTime ? (
            <time
              className="inline-voice-note__recorded-time"
              dateTime={String(voiceNote.createdAt)}
            >
              {recordedTime}
            </time>
          ) : null}
        </div>
      </div>

      <Link
        className="inline-voice-note__transcribe"
        to={`/voice/${String(voiceNote.id)}`}
      >
        Transcribe
      </Link>

      {blob.status === 'error' ? (
        <span className="inline-voice-note__error" role="status">
          Couldn&apos;t load recording. Open the voice note to try again.
        </span>
      ) : null}

      {blob.status === 'ready' ? (
        <audio
          ref={audioRef}
          src={blob.url}
          preload="metadata"
          className="inline-voice-note__audio"
        />
      ) : null}
    </article>
  );
}

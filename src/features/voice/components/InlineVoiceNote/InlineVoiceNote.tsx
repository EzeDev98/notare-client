import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PauseIcon, PlayIcon } from '@patternfly/react-icons';

import { useAudioBlob } from '@/features/voice/hooks/useAudioBlob';
import type { VoiceNoteResponse } from '@/features/voice/types';
import './InlineVoiceNote.css';
import { ROUTES } from '@/app/routes';

const WAVEFORM_BAR_COUNT = 32;
const WAVEFORM_BARS = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => index);

interface InlineVoiceNotesProps {
  voiceNotes: VoiceNoteResponse[];
  /**
   * Two-letter avatar label for every bubble this component renders.
   *
   * A single value for the whole list, not per-recording, and that is
   * correct here specifically: this component is the OWNER's own view of
   * their OWN note (NoteDetailPage's only caller), where every attached
   * recording is, by construction, the current user's — there is no
   * second person it could ever belong to. The shared-note equivalent
   * (`SharedInlineVoiceNotes`) is the one that resolves a DIFFERENT
   * recorder per bubble via `useUserLookup`, because a shared note can
   * carry recordings from several collaborators; this one never can.
   *
   * Previously hardcoded to the literal text "MJ" regardless of who was
   * actually signed in — harmless in that it never pointed at the wrong
   * PERSON's recording (there is only ever one possible person here), but
   * still wrong: it was nobody's real initials, so it read as a stray
   * placeholder rather than "this is you." Computed by the caller
   * (`formatUserInitials` on the signed-in user) and passed in here
   * instead, the same fallback chain every other avatar in the app uses.
   */
  ownerInitials: string;
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
export function InlineVoiceNotes({ voiceNotes, ownerInitials }: InlineVoiceNotesProps) {
  if (voiceNotes.length === 0) return null;

  return (
    <div className="inline-voice-notes" aria-label="Voice notes in this note">
      {voiceNotes.map((voiceNote) => (
        <InlineVoiceNote key={voiceNote.id} voiceNote={voiceNote} ownerInitials={ownerInitials} />
      ))}
    </div>
  );
}

function InlineVoiceNote({
  voiceNote,
  ownerInitials,
}: {
  voiceNote: VoiceNoteResponse;
  ownerInitials: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadRequested, setLoadRequested] = useState(false);
  /*
   * Set the moment the FIRST click asks for a load, cleared once that
   * play actually fires (or the load fails). Plain click-to-play looked
   * broken without this: clicking play while `blob.status === 'idle'`
   * only calls `setLoadRequested(true)` below and returns — nothing in
   * that branch ever calls `audio.play()`, because there's no audio to
   * play yet, only a blob download about to start. The download finishing
   * (blob.status flipping to 'ready') was a silent state change from the
   * user's point of view; the button just sat there showing the Play icon
   * until a SECOND click ran the `audio.paused` branch below and finally
   * started playback. This ref is what turns "download finished" into
   * "start the playback the user already asked for" — see the effect
   * below that watches `blob.url` for exactly that transition.
   */
  const pendingPlayRef = useRef(false);

  const blob = useAudioBlob(voiceNote.id, loadRequested);
  const audioUrl = blob.status === 'ready' ? blob.url : null;

  useEffect(() => {
    if (blob.status === 'error') {
      pendingPlayRef.current = false;
      return;
    }

    if (blob.status !== 'ready' || !pendingPlayRef.current) return;

    pendingPlayRef.current = false;

    const audio = audioRef.current;
    if (!audio) return;

    void audio.play().catch(() => {
      setPlaying(false);
    });
  }, [blob.status, audioUrl]);

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
  }, [audioUrl]);

  function togglePlayback() {
    if (blob.status === 'idle' || blob.status === 'error') {
      pendingPlayRef.current = true;
      setLoadRequested(true);
      return;
    }

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
            {ownerInitials}
          </div>

          <button
            type="button"
            className="inline-voice-note__play"
            onClick={togglePlayback}
            disabled={blob.status === 'loading'}
            aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          >
            {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
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
            <time
              className="inline-voice-note__recorded-time"
              dateTime={String(voiceNote.createdAt)}
            >
              {recordedTime}
            </time>
          ) : null}
        </div>
      </div>

      <Link className="inline-voice-note__transcribe" to={ROUTES.legacy.voiceDetail(voiceNote.id)}>
        Transcribe
      </Link>

      <audio
        ref={audioRef}
        src={blob.status === 'ready' ? blob.url : undefined}
        preload="metadata"
        className="inline-voice-note__audio"
        aria-label="Voice note audio"
      />
    </article>
  );
}

import { useTranscription } from '@/features/voice/hooks/useTranscription';
import { useSubmitTranscription } from '@/features/voice/hooks/useTranscriptionMutations';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import './TranscriptionPanel.css';

interface TranscriptionPanelProps {
  voiceNoteId: number;
}

/**
 * "Transcription panel" (architecture doc §4.2's Voice detail screen) —
 * the status union rendered as one screen per state, per §2.6's explicit
 * modelling requirement (see `features/voice/types.ts`'s doc comment on
 * `TranscriptionResponse`).
 *
 * No transcription submitted yet reads as a 404 from `GET
 * /voice-notes/{id}/transcription` — NOTARE-SERVER.md §7 only creates the
 * row once `POST .../transcription` is called, so "not started" and "does
 * not exist" are the same server-side fact, same conflation pattern this
 * codebase already uses for notes/shares/collaborations (404 means
 * "doesn't exist, or isn't yours", §2's own rule table).
 */
export function TranscriptionPanel({ voiceNoteId }: TranscriptionPanelProps) {
  const transcription = useTranscription(voiceNoteId);
  const submit = useSubmitTranscription(voiceNoteId);

  if (transcription.isLoading) {
    return (
      <div className="transcription-panel transcription-panel--centre">
        <Spinner label="Checking for a transcript" size="sm" />
      </div>
    );
  }

  // Not started: no row exists yet (404) — offer to submit.
  if (transcription.isError) {
    return (
      <div className="transcription-panel">
        <p className="transcription-panel__lead">No transcript yet.</p>
        <Button
          variant="secondary"
          size="sm"
          loading={submit.isPending}
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          Transcribe
        </Button>
      </div>
    );
  }

  const data = transcription.data;
  if (!data) return null;

  if (data.status === 'PENDING' || data.status === 'PROCESSING') {
    return (
      <div className="transcription-panel transcription-panel--centre">
        <Spinner label="Transcribing" size="sm" />
        <span className="transcription-panel__status-text">Transcribing…</span>
      </div>
    );
  }

  if (data.status === 'FAILED') {
    return (
      <div className="transcription-panel" role="alert">
        <p className="transcription-panel__error">Transcription failed: {data.errorMessage}</p>
        {/* submitTranscription is idempotent and resets FAILED -> PENDING
            (transcriptionService.ts's own doc comment) — this is a retry,
            not a second, different action. */}
        <Button
          variant="secondary"
          size="sm"
          loading={submit.isPending}
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // COMPLETED
  return (
    <div className="transcription-panel">
      <p className="transcription-panel__transcript">{data.transcript}</p>
      {data.language !== null || data.confidence !== null ? (
        <p className="transcription-panel__meta">
          {data.language !== null ? data.language : null}
          {data.language !== null && data.confidence !== null ? ' · ' : null}
          {data.confidence !== null
            ? `${String(Math.round(data.confidence * 100))}% confidence`
            : null}
        </p>
      ) : null}
    </div>
  );
}

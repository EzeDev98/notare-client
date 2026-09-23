import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { MicrophoneIcon } from '@patternfly/react-icons';

import { AudioPlayer } from '@/features/voice/components/AudioPlayer/AudioPlayer';
import { TranscriptionPanel } from '@/features/voice/components/TranscriptionPanel/TranscriptionPanel';
import { useVoiceNote } from '@/features/voice/hooks/useVoiceNotes';
import { useDeleteVoiceNote } from '@/features/voice/hooks/useVoiceNoteMutations';
import { formatServerDateTimeAbsolute } from '@/lib/time';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './VoiceDetail.css';

/**
 * Turns a route parameter into a voice-note id, or null. Same shape as
 * `parseNoteId` (`useNote.ts`) for the same reason: `Number('')` is `0`,
 * which would otherwise pass as a plausible id.
 *
 * Exported (not a page-local helper any more) so `ShareVoiceNotePage`
 * (`/voice/:voiceNoteId/share`) can parse the identical route param shape
 * without a second copy of this guard.
 */
export function parseVoiceNoteId(param: string | undefined): number | null {
  if (param === undefined) return null;
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * `/voice/:id` (architecture doc §4.2: "player with seeking, transcription
 * panel"). "Record and transcribe" (§3's usability scenario) mostly plays
 * out on the NOTE'S own page via `VoiceRecorder` + the inline list; this
 * screen is the durable, linkable destination for one specific recording.
 */
export function VoiceDetailPage() {
  const { voiceNoteId: param } = useParams();
  const id = parseVoiceNoteId(param);
  const navigate = useNavigate();

  const voiceNote = useVoiceNote(id ?? -1);
  const deleteVoiceNote = useDeleteVoiceNote(voiceNote.data?.noteId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  /*
   * Same pattern as RouteTransition.tsx's own hasMounted guard: this page
   * itself is never remounted on a param-only navigation (RouteTransition
   * keys on the matched route id, not the resolved :voiceNoteId), so this
   * ref reliably stays false only for the very first record shown and
   * true for every subsequent record switch within this page instance.
   */
  const contentHasMounted = useRef(false);

  useEffect(() => {
    contentHasMounted.current = true;
  }, []);

  useDocumentTitle(voiceNote.data ? 'Voice note' : 'Voice note');

  if (id === null) {
    return (
      <section className="voice-detail">
        <div className="voice-detail__centre">
          <h1>Voice note not found</h1>
          <Link to="/voice">Back to voice notes</Link>
        </div>
      </section>
    );
  }

  function handleDelete() {
    if (id === null) return;
    setDeleteModalOpen(true);
  }

  function confirmDelete() {
    if (id === null) return;
    setDeleteModalOpen(false);
    setError(null);
    deleteVoiceNote.mutate(id, {
      onSuccess: () => {
        navigate('/voice');
      },
      onError: () => {
        setError('Could not delete this recording. Check your connection and try again.');
      },
    });
  }

  return (
    <section className="voice-detail">
      <nav className="voice-detail__back">
        <Link to="/voice">← Voice notes</Link>
      </nav>

      {voiceNote.isLoading ? (
        <div className="voice-detail__centre">
          <Spinner label="Loading voice note" />
        </div>
      ) : null}

      {voiceNote.isError ? (
        <div className="voice-detail__centre" role="alert">
          <h1>Can&apos;t open this recording</h1>
          <p className="voice-detail__muted">
            This recording doesn&apos;t exist, or it isn&apos;t available to you.
          </p>
        </div>
      ) : null}

      {voiceNote.data ? (
        <div
          key={voiceNote.data.id}
          className="voice-detail__content"
          data-animate={contentHasMounted.current ? 'true' : undefined}
        >
          <header className="voice-detail__header">
            <h1>Voice note</h1>
            <p className="voice-detail__muted">
              Recorded{' '}
              <time dateTime={voiceNote.data.createdAt}>
                {formatServerDateTimeAbsolute(voiceNote.data.createdAt)}
              </time>
              {voiceNote.data.noteId !== null ? (
                <>
                  {' · '}
                  <Link to={`/notes/${String(voiceNote.data.noteId)}`}>View linked note</Link>
                </>
              ) : null}
            </p>
          </header>

          <AudioPlayer voiceNoteId={voiceNote.data.id} />

          <div className="voice-detail__section">
            <h2 className="voice-detail__section-title">Transcript</h2>
            <TranscriptionPanel voiceNoteId={voiceNote.data.id} />
          </div>

          <div className="voice-detail__danger-zone">
            <Button
              variant="danger"
              size="sm"
              loading={deleteVoiceNote.isPending}
              disabled={deleteVoiceNote.isPending}
              onClick={handleDelete}
            >
              Delete recording
            </Button>
            {error !== null ? (
              <p className="voice-detail__error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {voiceNote.data && deleteModalOpen ? (
        <Modal
          icon={<MicrophoneIcon aria-hidden="true" />}
          description="Delete this voice note? This voice note will be permanently deleted. This action cannot be undone."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setDeleteModalOpen(false);
            },
          }}
          primaryAction={{
            label: 'Delete',
            onClick: confirmDelete,
          }}
          onClose={() => {
            setDeleteModalOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
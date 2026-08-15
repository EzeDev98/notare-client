import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { VoiceNoteCard } from '@/features/voice/components/VoiceNoteCard/VoiceNoteCard';
import { useVoiceNotes, useVoiceNotesByNote } from '@/features/voice/hooks/useVoiceNotes';
import { useDeleteVoiceNote } from '@/features/voice/hooks/useVoiceNoteMutations';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './VoiceNotes.css';

/**
 * `/voice` (architecture doc §4.2: "list, filter by note"). The filter is
 * a `?noteId=` search param — a real URL a note detail page can link to
 * ("see all voice notes for this note"), not just in-page component state.
 */
export function VoiceNotesPage() {
  useDocumentTitle('Voice notes');

  const [searchParams] = useSearchParams();
  const noteIdParam = searchParams.get('noteId');
  const filterNoteId = noteIdParam !== null && !Number.isNaN(Number(noteIdParam)) ? Number(noteIdParam) : null;

  return filterNoteId !== null ? (
    <FilteredByNote noteId={filterNoteId} />
  ) : (
    <AllVoiceNotes />
  );
}

function AllVoiceNotes() {
  const [page, setPage] = useState(0);
  const voiceNotes = useVoiceNotes(page);
  const deleteVoiceNote = useDeleteVoiceNote(null);

  return (
    <section className="voice-notes">
      <h1>Voice notes</h1>

      {voiceNotes.isLoading ? (
        <div className="voice-notes__centre">
          <Spinner label="Loading voice notes" />
        </div>
      ) : null}

      {voiceNotes.isError ? (
        <div className="voice-notes__centre" role="alert">
          <p>Couldn&apos;t load your voice notes.</p>
        </div>
      ) : null}

      {voiceNotes.data && voiceNotes.data.content.length === 0 ? (
        <div className="voice-notes__centre">
          <p>No voice notes yet. Record one from any note.</p>
        </div>
      ) : null}

      {voiceNotes.data && voiceNotes.data.content.length > 0 ? (
        <>
          <ul className="voice-notes__list" role="list">
            {voiceNotes.data.content.map((vn) => (
              <VoiceNoteCard
                key={vn.id}
                voiceNote={vn}
                deleting={deleteVoiceNote.isPending && deleteVoiceNote.variables === vn.id}
                onDelete={(id) => {
                  deleteVoiceNote.mutate(id);
                }}
              />
            ))}
          </ul>

          <div className="voice-notes__pager">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0 || voiceNotes.isFetching}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!voiceNotes.data.hasNext || voiceNotes.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function FilteredByNote({ noteId }: { noteId: number }) {
  const voiceNotes = useVoiceNotesByNote(noteId);
  const deleteVoiceNote = useDeleteVoiceNote(noteId);

  return (
    <section className="voice-notes">
      <h1>Voice notes for this note</h1>

      {voiceNotes.isLoading ? (
        <div className="voice-notes__centre">
          <Spinner label="Loading voice notes" />
        </div>
      ) : null}

      {voiceNotes.isError ? (
        <div className="voice-notes__centre" role="alert">
          <p>Couldn&apos;t load voice notes for this note.</p>
        </div>
      ) : null}

      {voiceNotes.data && voiceNotes.data.length === 0 ? (
        <div className="voice-notes__centre">
          <p>No voice notes linked to this note yet.</p>
        </div>
      ) : null}

      {voiceNotes.data && voiceNotes.data.length > 0 ? (
        <ul className="voice-notes__list" role="list">
          {voiceNotes.data.map((vn) => (
            <VoiceNoteCard
              key={vn.id}
              voiceNote={vn}
              deleting={deleteVoiceNote.isPending && deleteVoiceNote.variables === vn.id}
              onDelete={(id) => {
                deleteVoiceNote.mutate(id);
              }}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

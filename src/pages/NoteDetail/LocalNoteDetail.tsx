import { Link, useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { useLocalNote } from '@/features/notes/hooks/useLocalNote';
import { InlineVoiceNotes } from '@/features/voice/components/InlineVoiceNote/InlineVoiceNote';
import { VoiceRecorder, type VoiceUploadHandle } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';
import { useUploadVoiceNote } from '@/features/voice/hooks/useVoiceNoteMutations';
import { useVoiceNotesByNote } from '@/features/voice/hooks/useVoiceNotes';
import { formatUserInitials } from '@/features/userLookup/hooks/useUserLookup';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';

/**
 * A note that has not reached the server yet.
 *
 * Lives at /notes/local/:localId — see NoteCard's routing comment for why a
 * note with serverId === null links here, and the fact that a note
 * stays on this route for its whole editing session: when a serverId is assigned
 * in the background nothing remounts, and the voice recorder appears in place. This page
 * exists only to resolve THIS side of that lifecycle, including a page
 * refresh while still on it — Dexie is queried by localId, and nothing here
 * ever asks the server about a UUID it has never heard of.
 *
 * Deliberately its own page rather than a branch inside NoteDetailPage.
 * useNote(serverId) fetches from the server on every mount — correct for a
 * note that HAS a server id, wrong for one that doesn't. Reusing it here
 * would mean feeding it something that is not a serverId (exactly what
 * parseNoteId exists to reject) or teaching it to skip the fetch for some
 * inputs, which blurs the boundary the two identities were given on purpose.
 * A small dedicated hook (useLocalNote) keeps that boundary intact while
 * still ending in the same NoteEditorHost every other note uses.
 */
export function LocalNoteDetailPage() {
  const { localId } = useParams();
  const state = useLocalNote(localId);

  const { state: authState } = useAuth();
  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const ownerInitials = formatUserInitials(
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user
      : undefined,
  );

  // Null until the first background sync assigns a server id. The page never
  // changes route when that happens: the mic simply becomes available here.
  const serverId = state.status === 'ready' ? state.row.serverId : null;
  const voiceNotes = useVoiceNotesByNote(serverId);
  const uploadMutation = useUploadVoiceNote();
  const upload: VoiceUploadHandle = {
    mutate: (variables, options) =>
      uploadMutation.mutate(
        { ...variables, ...(serverId !== null ? { noteId: serverId } : {}) },
        options,
      ),
    isPending: uploadMutation.isPending,
    isError: uploadMutation.isError,
  };

  // 1C/4G: no title field — the note domain has none. Same pattern as
  // NoteDetailPage's document title.
  const label = state.status === 'ready' ? deriveNoteLabel(state.row.content).label : null;
  useDocumentTitle(label ?? 'Note');


  return (
    <article className="note-detail">
      <div className="note-detail__scroll">
        {state.status === 'not-found' ? (
          <div className="note-detail__centre">
            <h1>Note not found</h1>
            <p className="note-detail__muted">
              This note doesn&apos;t exist, or it isn&apos;t available to you.
            </p>
            <Link to="/notes">Back to your notes</Link>
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <div
            className="note-detail__editor-region"
          >
            <NoteEditorHost
              row={state.row}
              currentUserId={currentUserId}
              contentAccessory={
                voiceNotes.data && voiceNotes.data.length > 0 ? (
                  <InlineVoiceNotes voiceNotes={voiceNotes.data} ownerInitials={ownerInitials} />
                ) : null
              }
            />
          </div>
        ) : null}

      </div>

      {state.status === 'ready' && state.row.serverId !== null ? (
        <VoiceRecorder upload={upload} noteId={state.row.serverId} />
      ) : null}
    </article>
  );
}
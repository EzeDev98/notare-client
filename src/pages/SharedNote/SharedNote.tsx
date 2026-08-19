import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { EditorSurface } from '@/features/editor/components/EditorSurface/EditorSurface';
import { parseNoteId } from '@/features/notes/hooks/useNote';
import { SharedInlineVoiceNotes } from '@/features/sharedNotes/components/SharedInlineVoiceNotes/SharedInlineVoiceNotes';
import { useAttachedVoiceNotes } from '@/features/sharedNotes/hooks/useAttachedVoiceNotes';
import { useUploadAttachedVoiceNote } from '@/features/sharedNotes/hooks/useUploadAttachedVoiceNote';
import { VoiceRecorder } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';
import {
  isNoGrantError,
  useSharedNote,
} from '@/features/sharedNotes/hooks/useSharedNote';
import { useSharedNotePermission } from '@/features/sharedNotes/hooks/useSharedNotePermission';
import { useUpdateSharedNote } from '@/features/sharedNotes/hooks/useUpdateSharedNote';
import { isConflict, isForbidden } from '@/lib/http/errors';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './SharedNote.css';

/**
 * `/shared/:id`
 *
 * Shared notes deliberately keep their own data/authorization path.
 *
 * This page reuses the normal note writing primitives visually, but it does
 * NOT use the owner's Dexie/local-note/editor state. Shared content remains
 * server-authoritative and online-only.
 *
 * WRITE:
 *   - edit title/content
 *   - record a voice note against this note
 *   - listen to attached voice notes
 *
 * READ:
 *   - view title/content
 *   - listen to attached voice notes
 *   - no editing
 *   - no voice recorder
 *
 * REVISED: attached voice notes and the recorder now go through the
 * NOTE-GRANT-gated paths (`useAttachedVoiceNotes`, `SharedInlineVoiceNotes`,
 * `useUploadAttachedVoiceNote`) instead of the owner-scoped
 * `useVoiceNotesByNote`/`InlineVoiceNotes`/plain `VoiceRecorder` upload,
 * which would 403/404 for a recipient viewing attachments they don't
 * personally own (the note owner's own recordings, or another
 * collaborator's).
 */
export function SharedNotePage() {
  const { noteId: noteIdParam } = useParams();
  const noteId = parseNoteId(noteIdParam);

  const query = useSharedNote(noteId ?? -1);

  const title = (query.data?.title ?? '').trim();

  useDocumentTitle(title === '' ? 'Shared note' : title);

  if (noteId === null) {
    return (
      <article className="shared-note">
        <SharedNoteChrome />

        <div className="shared-note__centre">
          <h1>Note not found</h1>
          <Link to="/shared">Back to shared with me</Link>
        </div>
      </article>
    );
  }

  return (
    <article className="shared-note">
      <SharedNoteChrome />

      {query.isLoading ? (
        <div className="shared-note__centre">
          <Spinner label="Loading this note" />
        </div>
      ) : null}

      {query.isError && isNoGrantError(query.error) ? (
        <div className="shared-note__centre">
          <h1>Not shared with you</h1>

          <p className="shared-note__muted">
            This note isn&apos;t available to you — it may have never been
            shared with you, or access may have changed.
          </p>

          <Link to="/shared">Back to shared with me</Link>
        </div>
      ) : null}

      {query.isError && !isNoGrantError(query.error) ? (
        <div className="shared-note__centre" role="alert">
          <h1>Can&apos;t open this note</h1>

          <p className="shared-note__muted">
            You&apos;re offline, or Notare can&apos;t be reached right now.
          </p>

          <button
            type="button"
            className="shared-note__retry"
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {query.data ? (
        <SharedNoteEditor
          noteId={noteId}
          note={{
            title: query.data.title ?? '',
            content: query.data.content ?? '',
            version: query.data.version,
          }}
        />
      ) : null}
    </article>
  );
}

function SharedNoteChrome() {
  return (
    <nav className="shared-note__back">
      <Link to="/shared">← Shared with me</Link>
    </nav>
  );
}

interface SharedNoteEditorProps {
  noteId: number;
  note: {
    title: string;
    content: string;
    version: number;
  };
}

function SharedNoteEditor({ noteId, note }: SharedNoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [version, setVersion] = useState(note.version);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [triedEditing, setTriedEditing] = useState(false);

  const cachedPermission = useSharedNotePermission(noteId);
  const update = useUpdateSharedNote(noteId);

  /*
   * The parent note owns its attached voice notes.
   *
   * REVISED: queried through the NOTE-GRANT-gated
   * `/shared-notes/{noteId}/voice-notes` (useAttachedVoiceNotes), not the
   * owner-scoped `/voice-notes/by-note/{noteId}` — that endpoint checks the
   * caller OWNS the note, which a recipient never does, so it would 403/404
   * here regardless of how strong their share grant is.
   *
   * Still deliberately queried by noteId rather than treated as a second
   * top-level Shared with me item — an attachment does not create its own
   * list entry, it lives inside this note's own page.
   */
  const voiceNotes = useAttachedVoiceNotes(noteId);
  const uploadVoiceNote = useUploadAttachedVoiceNote(noteId);

  const knownReadOnly = cachedPermission === 'READ';

  const readOnly =
    knownReadOnly ||
    (cachedPermission === undefined && !triedEditing);

  const dirty =
    title !== note.title ||
    content !== note.content;

  function handleBlur(): void {
    if (readOnly || !dirty || update.isPending) {
      return;
    }

    setConflictMessage(null);

    update.mutate(
      {
        title,
        content,
        version,
      },
      {
        onSuccess: (updated) => {
          setVersion(updated.version);
        },

        onError: (error) => {
          if (isConflict(error)) {
            setConflictMessage(
              'Someone else changed this note first. Your edit was not saved — reload to see the latest version.',
            );
            return;
          }

          if (isForbidden(error)) {
            setConflictMessage(
              "You don't have permission to edit this note.",
            );
            setTriedEditing(false);
            return;
          }

          setConflictMessage(
            'Could not save. Check your connection and try again.',
          );
        },
      },
    );
  }

  const showVoiceRecorder =
    cachedPermission === 'WRITE' ||
    (cachedPermission === undefined && triedEditing);

  return (
    <>
      <div className="shared-note__mode" role="status">
        {readOnly ? (
          <>
            <span>
              {cachedPermission === undefined
                ? "You're viewing this note."
                : "Read only — you don't have permission to edit this note."}
            </span>

            {cachedPermission === undefined ? (
              <button
                type="button"
                className="shared-note__try-edit"
                onClick={() => {
                  setTriedEditing(true);
                }}
              >
                Try editing
              </button>
            ) : null}
          </>
        ) : (
          <span>
            {update.isPending
              ? 'Saving…'
              : dirty
                ? 'Unsaved changes'
                : 'Saved'}
          </span>
        )}
      </div>

      {conflictMessage !== null ? (
        <p className="shared-note__conflict" role="alert">
          {conflictMessage}
        </p>
      ) : null}

      <EditorSurface
        title={title}
        content={content}
        onTitleChange={setTitle}
        onContentChange={setContent}
        readOnly={readOnly}
        onBlur={handleBlur}
      />

      {voiceNotes.isError ? (
        <p className="shared-note__muted" role="status">
          Voice notes could not be loaded.
        </p>
      ) : null}

      {voiceNotes.data && voiceNotes.data.length > 0 ? (
        <SharedInlineVoiceNotes noteId={noteId} voiceNotes={voiceNotes.data} />
      ) : null}

      {showVoiceRecorder ? (
        <div className="shared-note__voice-recorder">
          <VoiceRecorder
            upload={uploadVoiceNote}
            onUploaded={() => {
              void voiceNotes.refetch();
            }}
          />
        </div>
      ) : null}
    </>
  );
}

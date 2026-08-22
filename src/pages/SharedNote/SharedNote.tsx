import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { EditorSurface } from '@/features/editor/components/EditorSurface/EditorSurface';
import { parseNoteId } from '@/features/notes/hooks/useNote';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { SharedInlineVoiceNotes } from '@/features/sharedNotes/components/SharedInlineVoiceNotes/SharedInlineVoiceNotes';
import { useAttachedVoiceNotes } from '@/features/sharedNotes/hooks/useAttachedVoiceNotes';
import { useUploadAttachedVoiceNote } from '@/features/sharedNotes/hooks/useUploadAttachedVoiceNote';
import { VoiceRecorder } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';
import {
  isNoGrantError,
  useSharedNote,
} from '@/features/sharedNotes/hooks/useSharedNote';
import { useSharedNotePermission } from '@/features/sharedNotes/hooks/useSharedNotePermission';
import type { SharePermission } from '@/features/sharedNotes/types';
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
 * SHELL NOW MATCHES `NoteDetailPage` EXACTLY (`.note-detail` /
 * `.note-detail__scroll` there, `.shared-note` / `.shared-note__scroll`
 * here — same rules, just renamed). The ONLY visual difference between the
 * two pages is the back link: "← All notes" there, "← Shared with me"
 * here. In particular:
 *   - `.shared-note` is a flex column filling the pane, edge-to-edge, NOT
 *     capped to `--measure-prose` and centred — that read as a marketing
 *     article floating in the middle of the screen instead of a page in a
 *     notes app (see `.note-detail`'s own comment on the same point).
 *   - Everything that scrolls (back link, states, editor, voice list) lives
 *     inside `.shared-note__scroll`; the voice RECORDER is the one thing
 *     rendered as a sibling below it, so it can float bottom-right via
 *     `.voice-recorder__dock`'s `position: absolute` against `.shared-note`
 *     itself, exactly like `NoteDetailPage`.
 *
 * That floating placement is why the recorder's own hooks
 * (`useSharedNotePermission`, `useAttachedVoiceNotes`,
 * `useUploadAttachedVoiceNote`) and the `triedEditing` toggle now live in
 * `SharedNoteView` rather than down inside the editor — the editor (inside
 * the scroll region) and the recorder (outside it) are siblings, so
 * whatever decides "should the recorder show at all" has to sit above both
 * of them.
 *
 * WRITE:
 *   - edit content
 *   - record a voice note against this note
 *   - listen to attached voice notes
 *
 * READ:
 *   - view content
 *   - listen to attached voice notes
 *   - no editing
 *   - no voice recorder
 *
 * Attached voice notes and the recorder go through the NOTE-GRANT-gated
 * paths (`useAttachedVoiceNotes`, `SharedInlineVoiceNotes`,
 * `useUploadAttachedVoiceNote`) instead of the owner-scoped
 * `useVoiceNotesByNote`/`InlineVoiceNotes`/plain `VoiceRecorder` upload,
 * which would 403/404 for a recipient viewing attachments they don't
 * personally own (the note owner's own recordings, or another
 * collaborator's).
 */
export function SharedNotePage() {
  const { noteId: noteIdParam } = useParams();
  const noteId = parseNoteId(noteIdParam);

  return (
    <article className="shared-note">
      {noteId === null ? (
        <div className="shared-note__scroll">
          <SharedNoteChrome />
          <div className="shared-note__centre">
            <h1>Note not found</h1>
            <Link to="/shared">Back to shared with me</Link>
          </div>
        </div>
      ) : (
        <SharedNoteView noteId={noteId} />
      )}
    </article>
  );
}

/**
 * Everything that depends on `noteId` being real — split out from
 * `SharedNotePage` so the recorder (a sibling of the scroll region, per
 * this file's own top comment) and the editor inside it can share one
 * source of truth for permission/`triedEditing` without either one owning
 * the other.
 */
function SharedNoteView({ noteId }: { noteId: number }) {
  const query = useSharedNote(noteId);
  /*
   * 2D: no title field — the note domain has none (1B). The tab label is
   * derived the same way every other "what is this note called" surface
   * is (1C's `deriveNoteLabel`): the first line of content, falling back
   * to a placeholder only while the note hasn't loaded yet at all.
   */
  useDocumentTitle(
    query.data ? deriveNoteLabel(query.data.content ?? '').label : 'Shared note',
  );

  const [triedEditing, setTriedEditing] = useState(false);
  const cachedPermission = useSharedNotePermission(noteId);
  const voiceNotes = useAttachedVoiceNotes(noteId);
  const uploadVoiceNote = useUploadAttachedVoiceNote(noteId);

  const showVoiceRecorder =
    query.data !== undefined &&
    (cachedPermission === 'WRITE' || (cachedPermission === undefined && triedEditing));

  return (
    <>
      <div className="shared-note__scroll">
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
              content: query.data.content ?? '',
              version: query.data.version,
            }}
            cachedPermission={cachedPermission}
            triedEditing={triedEditing}
            onTriedEditingChange={setTriedEditing}
            voiceNotes={voiceNotes}
          />
        ) : null}
      </div>

      {showVoiceRecorder ? (
        <VoiceRecorder
          upload={uploadVoiceNote}
          noteId={noteId}
          onUploaded={() => {
            void voiceNotes.refetch();
          }}
        />
      ) : null}
    </>
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
    content: string;
    version: number;
  };
  /** Lifted up to `SharedNoteView` — see this file's top comment. */
  cachedPermission: SharePermission | undefined;
  triedEditing: boolean;
  onTriedEditingChange: (value: boolean) => void;
  voiceNotes: ReturnType<typeof useAttachedVoiceNotes>;
}

function SharedNoteEditor({
  noteId,
  note,
  cachedPermission,
  triedEditing,
  onTriedEditingChange,
  voiceNotes,
}: SharedNoteEditorProps) {
  const [content, setContent] = useState(note.content);
  const [version, setVersion] = useState(note.version);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const update = useUpdateSharedNote(noteId);

  const knownReadOnly = cachedPermission === 'READ';

  const readOnly =
    knownReadOnly ||
    (cachedPermission === undefined && !triedEditing);

  const dirty = content !== note.content;

  function handleBlur(): void {
    if (readOnly || !dirty || update.isPending) {
      return;
    }

    setConflictMessage(null);

    update.mutate(
      {
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
            onTriedEditingChange(false);
            return;
          }

          setConflictMessage(
            'Could not save. Check your connection and try again.',
          );
        },
      },
    );
  }

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
                  onTriedEditingChange(true);
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
        content={content}
        onContentChange={setContent}
        readOnly={readOnly}
        onBlur={handleBlur}
        /*
         * Passed IN rather than rendered as a sibling after `<EditorSurface>`
         * — matches `NoteEditorHost`'s own call exactly. `.editor-surface__body`
         * reserves 60vh (EditorSurface.css) for the writing area itself; a
         * sibling placed after the whole `<EditorSurface>` element lands
         * below that entire reserved block, which is what put a large gap
         * between the text and the voice note here. As a `contentAccessory`
         * it renders INSIDE `.editor-surface__body`, immediately after the
         * text (`EditorSurface.tsx`'s own doc comment on the accessory slot)
         * — same placement the owner's note gets.
         */
        contentAccessory={
          <>
            {voiceNotes.isError ? (
              <p className="shared-note__muted" role="status">
                Voice notes could not be loaded.
              </p>
            ) : null}

            {voiceNotes.data && voiceNotes.data.length > 0 ? (
              <SharedInlineVoiceNotes noteId={noteId} voiceNotes={voiceNotes.data} />
            ) : null}
          </>
        }
      />
    </>
  );
}

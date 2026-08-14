import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { EditorSurface } from '@/features/editor/components/EditorSurface/EditorSurface';
import { parseNoteId } from '@/features/notes/hooks/useNote';
import { isNoGrantError, useSharedNote } from '@/features/sharedNotes/hooks/useSharedNote';
import { useSharedNotePermission } from '@/features/sharedNotes/hooks/useSharedNotePermission';
import { useUpdateSharedNote } from '@/features/sharedNotes/hooks/useUpdateSharedNote';
import { isConflict, isForbidden } from '@/lib/http/errors';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './SharedNote.css';

/**
 * `/shared/:id` — a shared note in READ or WRITE mode, no pin/archive/delete
 * affordances at all (architecture doc §4.1 names this route's contract
 * verbatim). The client's own `permission` check is a UX convenience only,
 * same as types.ts's own doc comment insists — the server remains
 * authoritative, and this component's job is to make the common case look
 * right, not to be the enforcement. That framing matters more than usual
 * here — see `useSharedNotePermission`'s own doc comment for why the client
 * cannot always even know which permission it has.
 *
 * A DIFFERENT ROUTE FROM `/notes/:id` ON PURPOSE, not a shared component
 * branching on a prop. Merging them is exactly the "smart component" the
 * architecture doc warns is how the wrong authorization model gets applied
 * (§2.4) — this page has no Dexie, no outbox, no offline draft, and cannot
 * gain one by accident the way a shared component's unused prop paths can
 * silently start being relied on.
 */
export function SharedNotePage() {
  const { noteId: noteIdParam } = useParams();
  const noteId = parseNoteId(noteIdParam);

  const query = useSharedNote(noteId ?? -1);
  // `.title` is `string | null` on the wire (NoteResponse) — optional
  // chaining on `query.data` alone does not guard the field itself being
  // null, only `query.data` being undefined before the query resolves.
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
          {/*
            Deliberately vague about WHY, matching useSharedNote.ts's own doc
            comment: this 404 also covers a note that never existed, so
            saying "the owner revoked access" would be a claim the response
            does not actually support.
          */}
          <p className="shared-note__muted">
            This note isn&apos;t available to you — it may have never been shared with you, or
            access may have changed.
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
          // Normalised here, at the boundary — `NoteResponse.title`/
          // `.content` are `string | null` on the wire; `SharedNoteEditor`
          // deals in plain, non-nullable strings throughout, same as every
          // controlled text input in this codebase already does.
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
  note: { title: string; content: string; version: number };
}

/**
 * Split from `SharedNotePage` for one reason: hook order. `useState` below
 * needs `note` to already exist as its initial value, and that is only true
 * once the parent has already rendered the `query.data ? ... : null` branch
 * — putting the state directly in the page would mean calling useState
 * conditionally in spirit even where not in syntax. A dedicated child
 * mounted only once data exists sidesteps the question entirely.
 */
function SharedNoteEditor({ noteId, note }: SharedNoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [version, setVersion] = useState(note.version);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  /*
   * KNOWN LIMITATION, not fixed here: if the server copy changes while this
   * screen is open (a background refetch, or React Query revalidating on
   * window focus) and this component has no local edits, the new fields are
   * NOT adopted — `title`/`content` were seeded once from `note` and this
   * component never re-syncs from it. `NoteDetailPage` gets that for free
   * from `useLiveQuery` over Dexie; this page has no local store to be
   * "live" from, and building that reconciliation (safely — only adopting
   * when there is no unsaved local edit to protect) is a real piece of work
   * on its own, not a permission-model concern. What this page does
   * guarantee is the more important half: it will NEVER silently overwrite
   * an unsaved local edit with a background refetch — the cost of that
   * guarantee is a stale read, never a lost write.
   */

  const cachedPermission = useSharedNotePermission(noteId);
  /*
   * Three states, not two: known WRITE, known READ, and GENUINELY UNKNOWN
   * (no list-cache entry — a direct link, a bookmark, a refresh; see
   * `useSharedNotePermission`'s own doc comment). Defaulting unknown to
   * read-only is the conservative choice — it can only under-offer editing,
   * never let someone type into a field that predictably 403s on blur.
   * `triedEditing` is the escape hatch for the genuinely-unknown case: an
   * explicit action, not an assumption, and the first save attempt is what
   * actually confirms WRITE — same "server remains authoritative" principle
   * as everywhere else on this page.
   */
  const [triedEditing, setTriedEditing] = useState(false);
  const knownReadOnly = cachedPermission === 'READ';
  const readOnly = knownReadOnly || (cachedPermission === undefined && !triedEditing);

  const update = useUpdateSharedNote(noteId);
  const dirty = title !== note.title || content !== note.content;

  function handleBlur(): void {
    if (readOnly || !dirty) return;

    setConflictMessage(null);
    update.mutate(
      { title, content, version },
      {
        onSuccess: (updated) => {
          setVersion(updated.version);
        },
        onError: (error) => {
          if (isConflict(error)) {
            /*
             * NOT the owner editor's two-pane ConflictPanel — a WRITE
             * collaborator's edit conflicting with the owner's is a real
             * gap this step does not close. The honest thing available
             * without building that screen is refusing to silently
             * overwrite either side and saying so plainly.
             */
            setConflictMessage(
              'Someone else changed this note first. Your edit was not saved — reload to see the latest version.',
            );
          } else if (isForbidden(error)) {
            // The genuinely-unknown-permission escape hatch resolving to
            // "no" — or permission was revoked mid-session. Either way,
            // the server just gave the authoritative answer this page's
            // own cache-based guess could not.
            setConflictMessage("You don't have permission to edit this note.");
            setTriedEditing(false);
          } else {
            setConflictMessage('Could not save. Check your connection and try again.');
          }
        },
      },
    );
  }

  return (
    <>
      {readOnly ? (
        <p className="shared-note__mode" role="status">
          {cachedPermission === undefined
            ? "You're viewing this note."
            : "Read only — you don't have permission to edit this note."}
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
        </p>
      ) : (
        <p className="shared-note__mode" role="status">
          {update.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
        </p>
      )}

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
    </>
  );
}

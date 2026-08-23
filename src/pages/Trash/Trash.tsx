import { useState } from 'react';
import { NotebookPen } from 'lucide-react';

import { useTrash } from '@/features/notes/hooks/useTrash';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { formatServerDateTimeRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Trash.css';

export function TrashPage() {
  useDocumentTitle('Trash');

  const { notes, refreshing, refreshError, refresh, restore, deleteForever } = useTrash();

  /*
   * Confirmation is keyed by localId, not by server id. A note trashed while
   * offline has no server id, and the previous `number | null` could not
   * address it — the delete-forever confirmation simply would not open.
   */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const confirmingNote =
    notes?.find((note) => note.localId === confirmingId) ?? null;

  function closeConfirmation() {
    setConfirmingId(null);
  }

  function handleDeleteForever() {
    if (confirmingNote === null) return;

    const note = confirmingNote;

    setConfirmingId(null);
    void deleteForever(note);
  }

  return (
    <section className="trash">
      <h1>Trash</h1>

      <p className="trash__lead">
        Notes stay here until you delete them permanently.
      </p>

      {refreshError !== null ? (
        <p className="trash__offline" role="status">
          {refreshError}{' '}
          <button className="trash__retry" type="button" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : null}

      {notes !== undefined && notes.length === 0 && !refreshing ? (
        <div className="trash__centre">
          <p>Your trash is empty.</p>
        </div>
      ) : null}

      {notes !== undefined && notes.length > 0 ? (
        <ul className="trash__list" role="list">
          {notes.map((note) => {
            // 1C/4D: no title field — the note domain has none.
            const label = deriveNoteLabel(note.content).label;
            // Same fixed 18-character cutoff as Archived (NoteCard's
            // `titleMaxLength`) — Trash renders its own markup rather than
            // NoteCard, so the truncation is repeated here rather than
            // shared, but the rule is the same: 18 characters, then "…".
            const displayLabel = label.length > 18 ? `${label.slice(0, 18)}…` : label;

            return (
              <li className="trash__item" key={note.localId}>
                <div>
                  <p className="trash__title">{displayLabel}</p>

                  {note.deletedAt !== null ? (
                    <p className="trash__meta">
                      Trashed {formatServerDateTimeRelative(note.deletedAt)}
                    </p>
                  ) : (
                    <p className="trash__meta">Trashed on this device</p>
                  )}
                </div>

                <div className="trash__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Restore ${label}`}
                    onClick={() => void restore(note)}
                  >
                    Restore
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Permanently delete ${label}`}
                    onClick={() => {
                      setConfirmingId(note.localId);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {confirmingNote !== null ? (
        <Modal
          icon={<NotebookPen aria-hidden="true" />}
          description={
            <>
              Delete <strong>{deriveNoteLabel(confirmingNote.content).label}</strong>{' '}
              forever? This action cannot be undone.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeConfirmation,
          }}
          primaryAction={{
            label: 'Delete forever',
            onClick: handleDeleteForever,
          }}
          onClose={closeConfirmation}
        />
      ) : null}
    </section>
  );
}
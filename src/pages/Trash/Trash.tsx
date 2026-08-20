import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { NoteTabs } from '@/features/notes/components/NoteTabs/NoteTabs';
import { useTrash } from '@/features/notes/hooks/useTrash';
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
      <NoteTabs />

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
            const title = note.title.trim();
            const label = title === '' ? 'Untitled' : title;

            return (
              <li className="trash__item" key={note.localId}>
                <div>
                  <p className="trash__title">{label}</p>

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
          icon={<Trash2 aria-hidden="true" />}
          title="Delete note forever?"
          description={
            <>
              <strong>
                {confirmingNote.title.trim() || 'Untitled'}
              </strong>{' '}
              will be permanently deleted. This action cannot be undone.
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
          destructive
          onClose={closeConfirmation}
        />
      ) : null}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { PencilAltIcon } from '@patternfly/react-icons';

import { useTrash } from '@/features/notes/hooks/useTrash';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { BackButton } from '@/design-system/components/BackButton/BackButton';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { formatServerDateTimeRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Trash.css';

export function TrashPage() {
  useDocumentTitle('Trash');

  const { notes, refreshing, refreshError, refresh, restore, deleteForever, deleteManyForever } =
    useTrash();

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

  /*
   * Bulk delete — clearing out a large bin without a confirm-and-wait
   * round trip per note. A Set, not an array: selection is toggled by
   * localId far more often than it's iterated, and a hundred-item bin is
   * exactly the case where an array's O(n) `includes` check on every
   * checkbox render would start to be felt.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // A note that leaves the bin (restored, or individually deleted-forever)
  // should not linger in a stale selection — otherwise a later "select
  // all" could try to bulk-delete a note that is no longer here at all.
  useEffect(() => {
    if (notes === undefined) return;
    setSelectedIds((current) => {
      const stillPresent = new Set(notes.map((note) => note.localId));
      const next = new Set([...current].filter((id) => stillPresent.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [notes]);

  const selectedNotes = (notes ?? []).filter((note) => selectedIds.has(note.localId));
  const allSelected = notes !== undefined && notes.length > 0 && selectedIds.size === notes.length;

  function toggleSelected(localId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(localId)) {
        next.delete(localId);
      } else {
        next.add(localId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (notes === undefined) return;
    setSelectedIds(allSelected ? new Set() : new Set(notes.map((note) => note.localId)));
  }

  function closeBulkConfirmation() {
    setConfirmingBulkDelete(false);
  }

  async function handleBulkDeleteForever() {
    setConfirmingBulkDelete(false);
    setBulkDeleting(true);
    try {
      await deleteManyForever(selectedNotes);
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <section className="trash">
      <BackButton />
      {notes !== undefined && notes.length > 0 ? (
        <>
          <h1>Trash</h1>

          <p className="trash__lead">
            Notes stay here until you delete them permanently.
          </p>
        </>
      ) : null}

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
        <div className="trash__bulk-bar">
          <label className="trash__select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label={allSelected ? 'Deselect all notes' : 'Select all notes'}
            />
            {selectedIds.size > 0
              ? `${String(selectedIds.size)} selected`
              : 'Select all'}
          </label>

          <Button
            variant="danger"
            size="sm"
            disabled={selectedIds.size === 0 || bulkDeleting}
            loading={bulkDeleting}
            onClick={() => {
              setConfirmingBulkDelete(true);
            }}
          >
            Delete forever{selectedIds.size > 0 ? ` (${String(selectedIds.size)})` : ''}
          </Button>
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
                <div className="trash__item-main">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(note.localId)}
                    onChange={() => {
                      toggleSelected(note.localId);
                    }}
                    aria-label={`Select ${label}`}
                  />

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
          icon={<PencilAltIcon aria-hidden="true" />}
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

      {confirmingBulkDelete ? (
        <Modal
          icon={<PencilAltIcon aria-hidden="true" />}
          description={
            <>
              Delete <strong>{selectedIds.size}</strong>{' '}
              {selectedIds.size === 1 ? 'note' : 'notes'} forever? This action cannot be
              undone.
            </>
          }
          secondaryAction={{
            label: 'Cancel',
            onClick: closeBulkConfirmation,
          }}
          primaryAction={{
            label: 'Delete forever',
            onClick: () => {
              void handleBulkDeleteForever();
            },
          }}
          onClose={closeBulkConfirmation}
        />
      ) : null}
    </section>
  );
}
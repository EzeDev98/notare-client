import { useState } from 'react';

import { NoteTabs } from '@/features/notes/components/NoteTabs/NoteTabs';
import { useTrash } from '@/features/notes/hooks/useTrash';
import { Button } from '@/design-system/components/Button/Button';
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

  return (
    <section className="trash">
      <h1>Trash</h1>
      <NoteTabs />

      {/*
        NO countdown, and no "deleted in 30 days". Nothing on the server purges
        trashed notes — SyncRetentionJob sweeps the sync tables only — so a
        promise like that would be a lie the user acts on.
      */}
      <p className="trash__lead">Notes stay here until you delete them permanently.</p>

      {/*
        A BANNER, not a screen (the same inversion as the notes list). What is
        in the local bin stays readable, and a failed refresh is an aside.
      */}
      {refreshError !== null ? (
        <p className="trash__offline" role="status">
          {refreshError}{' '}
          <button className="trash__retry" type="button" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : null}

      {/*
        `notes === undefined` is Dexie not having answered yet — milliseconds,
        and a spinner for it flashes on every mount. An empty ARRAY is a
        genuinely empty bin. Conflating them shows "your trash is empty" before
        the query has run.
      */}
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
                  {/* No link: a trashed note has no detail view to open. */}
                  <p className="trash__title">{label}</p>
                  {note.deletedAt !== null ? (
                    <p className="trash__meta">
                      Trashed {formatServerDateTimeRelative(note.deletedAt)}
                    </p>
                  ) : (
                    /*
                      No server timestamp yet, which is the normal state for a
                      note trashed offline. Saying so beats inventing a time
                      from a clock the server never agreed with.
                    */
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

                  {confirmingId === note.localId ? (
                    <>
                      {/*
                        The wording IS the confirmation. "Confirm" would be
                        ambiguous for something irreversible — this says
                        exactly what the click does.
                      */}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setConfirmingId(null);
                          void deleteForever(note);
                        }}
                      >
                        Delete forever
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setConfirmingId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
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
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

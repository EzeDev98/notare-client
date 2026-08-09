import { useState } from 'react';

import { NoteTabs } from '@/features/notes/components/NoteTabs/NoteTabs';
import { useTrash } from '@/features/notes/hooks/useTrash';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { formatServerDateTimeRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Trash.css';

export function TrashPage() {
  useDocumentTitle('Trash');

  const { state, reload, restore, deleteForever } = useTrash();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

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

      {state.status === 'loading' ? (
        <div className="trash__centre">
          <Spinner label="Loading your trash" />
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="trash__centre" role="alert">
          <p>{state.message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && state.notes.length === 0 ? (
        <div className="trash__centre">
          <p>Your trash is empty.</p>
        </div>
      ) : null}

      {state.status === 'ready' && state.notes.length > 0 ? (
        <ul className="trash__list" role="list">
          {state.notes.map(({ note, deletedAt }) => {
            const title = note.title?.trim() ?? '';
            const label = title === '' ? 'Untitled' : title;

            return (
              <li className="trash__item" key={note.id}>
                <div>
                  {/* No link: a trashed note has no detail view to open. */}
                  <p className="trash__title">{label}</p>
                  {deletedAt !== null ? (
                    <p className="trash__meta">Trashed {formatServerDateTimeRelative(deletedAt)}</p>
                  ) : null}
                </div>

                <div className="trash__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Restore ${label}`}
                    onClick={() => void restore(note.id)}
                  >
                    Restore
                  </Button>

                  {confirmingId === note.id ? (
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
                          void deleteForever(note.id);
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
                        setConfirmingId(note.id);
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

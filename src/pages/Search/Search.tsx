import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';

import { NoteCard } from '@/features/notes/components/NoteCard/NoteCard';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNoteActions } from '@/features/notes/hooks/useNoteActions';
import { useNoteSearch } from '@/features/notes/hooks/useNoteSearch';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { TextField } from '@/design-system/components/TextField/TextField';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Search.css';

const DEBOUNCE_MS = 300;

export function SearchPage() {
  useDocumentTitle('Search');

  const [searchParams, setSearchParams] = useSearchParams();

  const [term, setTerm] = useState(() => searchParams.get('q') ?? '');
  const debouncedTerm = useDebouncedValue(term, DEBOUNCE_MS);

  const state = useNoteSearch(debouncedTerm);

  useEffect(() => {
    setSearchParams(debouncedTerm.trim() === '' ? {} : { q: debouncedTerm.trim() }, {
      replace: true,
    });
  }, [debouncedTerm, setSearchParams]);

  /*
   * ACTIONS ARE REAL, as of 7G. A search result used to be a server summary
   * with no local row behind it, so pin/archive/delete had nothing to write
   * to. Search now reads the same Dexie rows every other list does — the
   * SAME hooks Notes.tsx uses, writing to the SAME table — so there is no
   * reason left to withhold the affordance.
   *
   * Archiving a result does not remove it from view: search deliberately
   * covers both archived states (see noteRepository.search), so a note stays
   * visible right after being archived from here. Deleting DOES remove it —
   * the live query excludes `deleted`, so the list updates itself the moment
   * the row is trashed, same as every other screen.
   */
  const { togglePin, setArchived } = useNoteActions();
  const deleteNote = useDeleteNote();

  const actions = {
    onTogglePin: (note: NoteView) => void togglePin(note),
    onToggleArchive: (note: NoteView) => void setArchived(note, !note.archived),
    onDelete: (note: NoteView) => void deleteNote(note),
  };

  const visible = state.status === 'ready' ? state.results : [];

  return (
    <section className="search">
      <h1>Search</h1>

      <div className="search__field">
        <TextField
          label="Search your notes"
          type="search"
          autoComplete="off"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
          }}
        />
        {state.status === 'loading' ? (
          <span className="search__indicator">
            <Spinner size="sm" label="Searching" />
          </span>
        ) : null}
      </div>

      {state.status === 'idle' ? (
        <p className="search__hint">Search across the contents of all your notes.</p>
      ) : null}

      {state.status === 'ready' ? (
        <p className="search__count" role="status">
          {state.total === 0
            ? `No notes match “${state.term}”.`
            : `${String(state.total)} ${state.total === 1 ? 'note' : 'notes'} match “${state.term}”.`}
        </p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="search__list" role="list">
          {visible.map((note) => (
            <NoteCard key={note.localId} note={note} actions={actions} />
          ))}
        </ul>
      ) : null}

      {state.status === 'ready' && state.results.length === 0 ? (
        <div className="search__empty">
          <p>Try a different word, or check the spelling.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setTerm('');
            }}
          >
            Clear search
          </Button>
        </div>
      ) : null}
    </section>
  );
}

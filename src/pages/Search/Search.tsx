import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { NoteCard } from '@/features/notes/components/NoteCard/NoteCard';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNoteSearch } from '@/features/notes/hooks/useNoteSearch';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { TextField } from '@/design-system/components/TextField/TextField';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Search.css';

/**
 * 300ms. Below about 200 the debounce stops saving requests for an average
 * typist; above about 400 the UI starts feeling like it is lagging behind the
 * keyboard.
 */
const DEBOUNCE_MS = 300;

export function SearchPage() {
  useDocumentTitle('Search');

  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * The input is LOCAL state so typing is instant; the URL is updated from the
   * DEBOUNCED value below. Driving the input from the URL directly would mean
   * a router navigation per keystroke.
   *
   * Initialised from the URL once, so /search?q=meeting arrives with the box
   * filled — which is what makes the URL worth having.
   */
  const [term, setTerm] = useState(() => searchParams.get('q') ?? '');
  const debouncedTerm = useDebouncedValue(term, DEBOUNCE_MS);

  const state = useNoteSearch(debouncedTerm);

  useEffect(() => {
    /*
     * replace: true. Without it, typing eight characters leaves eight history
     * entries between the user and wherever they came from — Back becomes a
     * character-by-character rewind of their own typing.
     */
    setSearchParams(debouncedTerm.trim() === '' ? {} : { q: debouncedTerm.trim() }, {
      replace: true,
    });
  }, [debouncedTerm, setSearchParams]);

  // Deleting from search results: the note leaves this list, and undo is a
  // no-op here because the results will not be re-fetched.
  const deleteNote = useDeleteNote({ onRemove: () => () => undefined });

  const visible =
    state.status === 'ready' ? state.results : state.status === 'searching' ? state.previous : [];

  return (
    <section className="search">
      <h1>Search</h1>

      {/*
        type="search" gives a native clear button in most browsers and Escape
        to clear — behaviour worth inheriting rather than reimplementing.
      */}
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
        {/* Sits over the field while a request is in flight, rather than
            replacing the results below. */}
        {state.status === 'searching' ? (
          <span className="search__indicator">
            <Spinner size="sm" label="Searching" />
          </span>
        ) : null}
      </div>

      {state.status === 'idle' ? (
        <p className="search__hint">Search across the titles and contents of all your notes.</p>
      ) : null}

      {state.status === 'error' ? (
        <p className="search__error" role="alert">
          {state.message}
        </p>
      ) : null}

      {/*
        Announced politely, so a screen-reader user learns the result count
        without the list itself being read out on every keystroke.
      */}
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
            <NoteCard
              key={note.id}
              note={note}
              onDelete={(noteId, title) => void deleteNote(noteId, title)}
              // Search results are not a list we own — pin and archive from
              // here would leave the row showing a stale state with nothing to
              // refresh it. Open the note instead.
              onTogglePin={() => undefined}
              onToggleArchive={() => undefined}
            />
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

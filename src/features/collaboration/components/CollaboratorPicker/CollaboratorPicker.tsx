import { useState } from 'react';

import { TextField } from '@/design-system/components/TextField/TextField';
import { useUserSearch } from '@/features/collaboration/hooks/useUserSearch';
import type { UserSummaryResponse } from '@/features/collaboration/types';
import './CollaboratorPicker.css';

interface CollaboratorPickerProps {
  /** Excluded from results — used to filter out people already invited (a
   * collaboration is a person-to-person relationship, not scoped to any
   * one note — types.ts's own doc comment on `CollaborationResponse`). */
  excludeIds?: number[];
  onSelect: (user: UserSummaryResponse) => void;
}

/**
 * A search-as-you-type input over GET /user/search, resolving to a single
 * pick. Deliberately uncontrolled from the caller's side beyond `onSelect`:
 * the picker owns its own query text and clears it after a selection, so a
 * form embedding this does not need to reset picker-internal state itself.
 */
export function CollaboratorPicker({ excludeIds = [], onSelect }: CollaboratorPickerProps) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError } = useUserSearch(query);

  const results = (data?.content ?? []).filter((user) => !excludeIds.includes(user.id));

  function handleSelect(user: UserSummaryResponse) {
    onSelect(user);
    setQuery('');
  }

  return (
    <div className="collaborator-picker">
      <TextField
        label="Add a collaborator"
        placeholder="Search by name, username, or email"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        autoComplete="off"
      />

      {query.trim().length > 0 && (
        <ul className="collaborator-picker__results" role="listbox">
          {isLoading && <li className="collaborator-picker__status">Searching…</li>}

          {isError && (
            <li className="collaborator-picker__status collaborator-picker__status--error">
              Couldn't search right now. Try again.
            </li>
          )}

          {!isLoading && !isError && results.length === 0 && (
            <li className="collaborator-picker__status">No one found.</li>
          )}

          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="collaborator-picker__result"
                role="option"
                aria-selected={false}
                onClick={() => {
                  handleSelect(user);
                }}
              >
                <span className="collaborator-picker__name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="collaborator-picker__username">@{user.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState } from 'react';

import { TextField } from '@/design-system/components/TextField/TextField';
import { useUserSearch } from '@/features/collaboration/hooks/useUserSearch';
import type { UserSummaryResponse } from '@/features/collaboration/types';
import './CollaboratorPicker.css';

interface CollaboratorPickerProps {
  /**
   * Search and selection component only.
   *
   * This component deliberately does NOT filter users based on existing
   * collaborations. A user may have been invited before, rejected an
   * invitation, accepted an invitation, or have no relationship at all.
   *
   * The caller decides what action is appropriate for the selected user.
   */
  onSelect: (user: UserSummaryResponse) => void;
}

/**
 * Search-as-you-type user picker.
 *
 * The picker has no knowledge of collaboration state. Its responsibility is
 * only to search users and return the selected user to its caller.
 */
export function CollaboratorPicker({ onSelect }: CollaboratorPickerProps) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError } = useUserSearch(query);

  const results = data?.content ?? [];

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
          {isLoading && (
            <li className="collaborator-picker__status">
              Searching…
            </li>
          )}

          {isError && (
            <li className="collaborator-picker__status collaborator-picker__status--error">
              Couldn't search right now. Try again.
            </li>
          )}

          {!isLoading && !isError && results.length === 0 && (
            <li className="collaborator-picker__status">
              No one found.
            </li>
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

                <span className="collaborator-picker__username">
                  @{user.username}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

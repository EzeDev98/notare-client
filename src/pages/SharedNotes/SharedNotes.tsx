import { useMemo, useState } from 'react';

import { SharedNoteCard } from '@/features/sharedNotes/components/SharedNoteCard/SharedNoteCard';
import { SharedVoiceNoteCard } from '@/features/sharedVoiceNotes/components/SharedVoiceNoteCard/SharedVoiceNoteCard';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { useSharedItems } from '@/pages/SharedNotes/sharedItems';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { Button } from '@/design-system/components/Button/Button';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './SharedNotes.css';

const PAGE_SIZE = 20;

/**
 * "Shared with me" (`/shared`).
 *
 * The recipient-facing collection is intentionally note-centric.
 *
 * A shared text note is one row.
 * Voice notes attached to that note belong to the note and do not create
 * additional rows here.
 * A standalone shared voice note has no parent note, so it remains as a
 * top-level note-like row.
 *
 * The page deliberately has no All / Notes / Voice tabs. Those were views
 * over two different collections, but the user-facing model is now one
 * collection of shared note containers.
 *
 * ONLINE-ONLY, same as the underlying shared collections. There is no Dexie
 * or offline fallback on this recipient route.
 */
export function SharedNotesPage() {
  useDocumentTitle('Shared with me');

  const [page, setPage] = useState(0);
  const { items, notesQuery, voiceQuery } = useSharedItems(page, PAGE_SIZE);

  /*
   * One batch lookup covering both underlying collections. This remains
   * page-level so switching between different rows never creates one request
   * per card.
   */
  const ownerIds = useMemo(
    () => [
      ...(notesQuery.data?.content ?? []).map((shared) => shared.ownerId),
      ...(voiceQuery.data?.content ?? []).map((shared) => shared.ownerId),
    ],
    [notesQuery.data, voiceQuery.data],
  );

  const { profiles, isLoading: ownerNamesLoading } = useUserLookup(ownerIds);

  function ownerNameFor(ownerId: number): string | undefined {
    return ownerNamesLoading ? undefined : formatUserName(profiles.get(ownerId));
  }

  /*
   * There is still no true merged cursor across the two independent server
   * collections. Keep the existing lockstep pagination behaviour rather than
   * inventing client-side pagination semantics that the server does not
   * provide.
   *
   * For the unified list, either source having a full page means another
   * source page may contain more shared content.
   */
  const notesHasMore = (notesQuery.data?.content.length ?? 0) === PAGE_SIZE;
  const voiceHasMore = (voiceQuery.data?.content.length ?? 0) === PAGE_SIZE;
  const hasMore = notesHasMore || voiceHasMore;

  const isFetching = notesQuery.isFetching || voiceQuery.isFetching;

  function goToPreviousPage(): void {
    setPage((current) => Math.max(0, current - 1));
  }

  function goToNextPage(): void {
    setPage((current) => current + 1);
  }

  const bothQueriesFailed = notesQuery.isError && voiceQuery.isError;
  const notesFailed = notesQuery.isError && !voiceQuery.isError;
  const voiceFailed = voiceQuery.isError && !notesQuery.isError;

  const bothSucceeded =
    notesQuery.isSuccess && voiceQuery.isSuccess;

  return (
    <section className="shared-notes">
      <header className="shared-notes__header">
        <h1>Shared with me</h1>
      </header>

      {/*
       * Initial loading only blocks the page when neither source has supplied
       * anything yet. Once one collection has data, its rows remain visible
       * while the other collection resolves.
       */}
      {(notesQuery.isLoading || voiceQuery.isLoading) && items.length === 0 ? (
        <div className="shared-notes__centre">
          <Spinner label="Loading shared notes" />
        </div>
      ) : null}

      {bothQueriesFailed ? (
        <div className="shared-notes__centre" role="alert">
          <p>Couldn&apos;t load what&apos;s been shared with you.</p>
          <button
            type="button"
            className="shared-notes__retry"
            onClick={() => {
              void notesQuery.refetch();
              void voiceQuery.refetch();
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {notesFailed ? (
        <div className="shared-notes__partial-error" role="alert">
          <p>Couldn&apos;t load shared notes.</p>
          <button
            type="button"
            className="shared-notes__retry"
            onClick={() => void notesQuery.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {voiceFailed ? (
        <div className="shared-notes__partial-error" role="alert">
          <p>Couldn&apos;t load shared voice notes.</p>
          <button
            type="button"
            className="shared-notes__retry"
            onClick={() => void voiceQuery.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {bothSucceeded && items.length === 0 ? (
        <div className="shared-notes__centre">
          <h2 className="shared-notes__empty-title">
            Nothing shared with you yet
          </h2>
          <p className="shared-notes__empty-body">
            When someone shares a note or voice note with you, it will appear
            here.
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="shared-notes__list" role="list">
          {items.map((item) =>
            item.type === 'note' ? (
              <SharedNoteCard
                key={`note-${String(item.note.note.id)}`}
                shared={item.note}
                ownerName={ownerNameFor(item.note.ownerId)}
              />
            ) : (
              <SharedVoiceNoteCard
                key={`standalone-voice-${String(item.voiceNote.voiceNoteId)}`}
                shared={item.voiceNote}
                ownerName={ownerNameFor(item.voiceNote.ownerId)}
              />
            ),
          )}
        </ul>
      ) : null}

      {items.length > 0 || page > 0 || hasMore ? (
        <div className="shared-notes__pager">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0 || isFetching}
            onClick={goToPreviousPage}
          >
            Previous
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={!hasMore || isFetching}
            onClick={goToNextPage}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}

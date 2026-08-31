import { useMemo, useState } from 'react';

import { SharedNoteCard } from '@/features/sharedNotes/components/SharedNoteCard/SharedNoteCard';
import { useSharedWithMeFeed } from '@/features/sharedNotes/hooks/useSharedWithMeFeed';
import { SharedVoiceCard } from '@/features/sharedVoiceNotes/components/SharedVoiceCard/SharedVoiceCard';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { BackButton } from '@/design-system/components/BackButton/BackButton';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { Button } from '@/design-system/components/Button/Button';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './SharedNotes.css';

const PAGE_SIZE = 20;

/**
 * "Shared with me" — a single merged feed, no All/Notes/Voice split.
 *
 * REVISED per the note-is-always-the-parent brief: a standalone shared voice
 * note renders as a note-shaped card (`SharedVoiceCard`) right alongside
 * shared text notes, sorted together by `sharedAt`. A voice note attached to
 * a shared note does NOT get its own card here — `useSharedWithMeFeed`
 * filters those out, since they're reachable from inside that note's own
 * detail page instead.
 *
 * ONLINE-ONLY, same as before: no Dexie, no offline fallback for either
 * underlying list.
 *
 * PAGINATION: Prev/Next only, same no-precise-total reasoning as before —
 * see `useSharedWithMeFeed`'s own doc comment for how the merge interacts
 * with paging across two independent server-side lists.
 */
export function SharedNotesPage() {
  useDocumentTitle('Shared with me');

  const [page, setPage] = useState(0);
  const { items, isLoading, isError, isPartialError, isFetching, hasMoreNotes, hasMoreVoice, refetch } =
    useSharedWithMeFeed(page, PAGE_SIZE);

  /*
   * One batch lookup covering both item kinds in the merged feed — the same
   * "resolve every row's owner in ONE request" contract `useUserLookup`
   * documents itself, not a per-card fetch. Kept at the page level so
   * switching pages never creates one lookup per card.
   */
  const ownerIds = useMemo(() => items.map((item) => item.data.ownerId), [items]);
  const { profiles, isLoading: ownerNamesLoading } = useUserLookup(ownerIds);

  function ownerNameFor(ownerId: number): string | undefined {
    return ownerNamesLoading ? undefined : formatUserName(profiles.get(ownerId));
  }

  const hasMore = hasMoreNotes || hasMoreVoice;

  return (
    <section className="shared-notes">
      <BackButton />
      <header className="shared-notes__header">
        <h1>Shared with me</h1>
      </header>

      {isLoading ? (
        <div className="shared-notes__centre">
          <Spinner label="Loading shared notes" />
        </div>
      ) : null}

      {isError ? (
        <div className="shared-notes__centre" role="alert">
          <p>Couldn&apos;t load your shared notes.</p>
          <button type="button" className="shared-notes__retry" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : null}

      {!isError && isPartialError ? (
        <p className="shared-notes__partial-error" role="status">
          Some shared items couldn&apos;t be loaded right now.
        </p>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="shared-notes__centre">
          <h2 className="shared-notes__empty-title">Nothing shared with you yet</h2>
          <p className="shared-notes__empty-body">
            When someone shares a note or voice recording with you, it will show up here.
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <ul className="shared-notes__list" role="list">
            {items.map((item) =>
              item.kind === 'note' ? (
                <SharedNoteCard
                  key={`note-${String(item.data.note.id)}`}
                  shared={item.data}
                  ownerName={ownerNameFor(item.data.ownerId)}
                />
              ) : (
                <SharedVoiceCard
                  key={`voice-${String(item.data.voiceNoteId)}`}
                  shared={item.data}
                  ownerName={ownerNameFor(item.data.ownerId)}
                />
              ),
            )}
          </ul>

          <div className="shared-notes__pager">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasMore || isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

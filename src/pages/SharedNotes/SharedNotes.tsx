import { useState } from 'react';

import { SharedNoteCard } from '@/features/sharedNotes/components/SharedNoteCard/SharedNoteCard';
import { useSharedNotes } from '@/features/sharedNotes/hooks/useSharedNotes';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { Button } from '@/design-system/components/Button/Button';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './SharedNotes.css';

const PAGE_SIZE = 20;

/**
 * "Shared with me" (architecture doc §4.1: `/shared`, "permission badge per
 * row"). The recipient side's entry point — 9A built the query layer this
 * reads; nothing rendered it until now.
 *
 * ONLINE-ONLY, same as `sharedNoteService` itself: no Dexie, no offline
 * fallback. TanStack Query's own cache is the only thing keeping a
 * previously-loaded page on screen (`placeholderData: keepPreviousData`,
 * `useSharedNotes.ts`), which is why this page's "error" state, unlike
 * `Notes.tsx`'s, replaces the list rather than sitting beside it: there is
 * no local copy underneath it to fall back to.
 *
 * NO PRECISE TOTAL. `totalElements` overcounts (it includes trashed notes
 * on the owner's side — `useSharedNotes.ts`'s own doc comment, architecture
 * doc §2.4), so pagination here is Prev/Next with no page count, never "Page
 * 2 of 5".
 */
export function SharedNotesPage() {
  useDocumentTitle('Shared with me');

  const [page, setPage] = useState(0);
  const { data, isLoading, isError, isFetching, refetch } = useSharedNotes(page, PAGE_SIZE);

  return (
    <section className="shared-notes">
      <header className="shared-notes__header">
        <h1>Shared with me</h1>
      </header>

      {isLoading ? (
        /*
         * Spinner, not a skeleton — architecture doc §4.4 asks for a
         * skeleton "where the shape is known", and there is no Skeleton
         * component in the design system yet (checked before writing this:
         * NoteDetail.tsx's own loading state uses Spinner for the same
         * reason). Building one is worth doing, but it is a design-system
         * addition, not a permission-model one — out of this step's scope.
         */
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

      {data && data.content.length === 0 ? (
        <div className="shared-notes__centre">
          <h2 className="shared-notes__empty-title">Nothing shared with you yet</h2>
          <p className="shared-notes__empty-body">
            When someone shares a note with you, it will show up here.
          </p>
        </div>
      ) : null}

      {data && data.content.length > 0 ? (
        <>
          <ul className="shared-notes__list" role="list">
            {data.content.map((shared) => (
              <SharedNoteCard key={shared.note.id} shared={shared} />
            ))}
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
            {/*
              No "Page X of Y" — there is no reliable Y (see this file's own
              doc comment on totalElements). `content.length < PAGE_SIZE` is
              a correct "no more pages" signal regardless of what the
              (overcounted) total claims.
            */}
            <Button
              variant="secondary"
              size="sm"
              disabled={data.content.length < PAGE_SIZE || isFetching}
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

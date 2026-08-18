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

type SharedTab = 'all' | 'notes' | 'voice';

/**
 * "Shared with me" (architecture doc §4.1: `/shared`, "permission badge per
 * row"). The recipient side's entry point.
 *
 * ONLINE-ONLY, same as `sharedNoteService`/`sharedVoiceNoteService`
 * themselves: no Dexie, no offline fallback. TanStack Query's own cache is
 * the only thing keeping a previously-loaded page on screen
 * (`placeholderData: keepPreviousData` on both underlying hooks), which is
 * why this page's error states, unlike `Notes.tsx`'s, replace rather than
 * sit beside their tab's content: there is no local copy underneath either
 * one to fall back to.
 *
 * NO PRECISE TOTAL, on either collection (`useSharedNotes.ts`'s own doc
 * comment on `totalElements` overcounting applies to both), so pagination
 * here is Prev/Next with no page count, never "Page 2 of 5".
 *
 * TABS — local `useState`, not routes, mirroring `InvitationsPage`'s
 * reasoning: All/Notes/Voice are the same kind of screen (a list of
 * shared-with-me rows) viewed at different filters, not different screens
 * with different actions.
 *
 * TWO INDEPENDENT SERVER COLLECTIONS behind one page — `useSharedItems`
 * (10b) owns the merge/sort for the All tab and hands back `notesQuery`/
 * `voiceQuery` alongside the combined `items`, specifically so this page can
 * treat their loading/error states separately (this step, 10e) rather than
 * collapsing two independently-failable requests into one boolean. See the
 * per-tab render blocks below for exactly what "independently" means for
 * each tab.
 */
export function SharedNotesPage() {
  useDocumentTitle('Shared with me');

  const [tab, setTab] = useState<SharedTab>('all');
  const [page, setPage] = useState(0);
  const { items, notesQuery, voiceQuery } = useSharedItems(page, PAGE_SIZE);

  /*
   * ONE batch lookup covering BOTH collections' owner ids at once, gathered
   * regardless of which tab is active — `useUserLookup`'s own doc comment
   * ("the call stays singular even then, it just gathers ids from both
   * sources instead of one"). Switching tabs then never triggers a new
   * lookup request: whichever ids are already resolved stay resolved.
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
   * Per-tab "has a next page" check. There is no true merged cursor across
   * two independently-paginated collections (`sharedItems.ts`'s own
   * documented lockstep-paging simplification) — for the All tab, Next
   * stays enabled if EITHER source returned a full page, since either one
   * alone could still have more rows waiting.
   */
  const notesHasMore = (notesQuery.data?.content.length ?? 0) === PAGE_SIZE;
  const voiceHasMore = (voiceQuery.data?.content.length ?? 0) === PAGE_SIZE;
  const hasMoreForTab =
    tab === 'notes' ? notesHasMore : tab === 'voice' ? voiceHasMore : notesHasMore || voiceHasMore;

  const currentTabHasContent =
    tab === 'notes'
      ? (notesQuery.data?.content.length ?? 0) > 0
      : tab === 'voice'
        ? (voiceQuery.data?.content.length ?? 0) > 0
        : items.length > 0;

  const isFetchingForTab =
    tab === 'notes'
      ? notesQuery.isFetching
      : tab === 'voice'
        ? voiceQuery.isFetching
        : notesQuery.isFetching || voiceQuery.isFetching;

  function goToPreviousPage() {
    setPage((current) => Math.max(0, current - 1));
  }

  function goToNextPage() {
    setPage((current) => current + 1);
  }

  return (
    <section className="shared-notes">
      <header className="shared-notes__header">
        <h1>Shared with me</h1>
      </header>

      <div className="shared-notes__tabs" role="tablist" aria-label="Shared with me views">
        <button
          type="button"
          role="tab"
          id="shared-notes-tab-all"
          aria-selected={tab === 'all'}
          aria-controls="shared-notes-panel-all"
          className="shared-notes__tab"
          onClick={() => {
            setTab('all');
          }}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          id="shared-notes-tab-notes"
          aria-selected={tab === 'notes'}
          aria-controls="shared-notes-panel-notes"
          className="shared-notes__tab"
          onClick={() => {
            setTab('notes');
          }}
        >
          Notes
        </button>
        <button
          type="button"
          role="tab"
          id="shared-notes-tab-voice"
          aria-selected={tab === 'voice'}
          aria-controls="shared-notes-panel-voice"
          className="shared-notes__tab"
          onClick={() => {
            setTab('voice');
          }}
        >
          Voice
        </button>
      </div>

      {tab === 'all' ? (
        <div id="shared-notes-panel-all" role="tabpanel" aria-labelledby="shared-notes-tab-all">
          {/*
            SPINNER only while NEITHER source has anything to show yet —
            `isLoading` is each query's true first-load flag (false once any
            data, even placeholder-kept data from a prior page, is present).
            If one source is already showing rows while the other is still
            on its first load, we fall through to rendering `items` as-is
            rather than blocking on the slower one — the acceptance
            criterion this step exists for.
          */}
          {(notesQuery.isLoading || voiceQuery.isLoading) && items.length === 0 ? (
            <div className="shared-notes__centre">
              <Spinner label="Loading shared items" />
            </div>
          ) : null}

          {/*
            BOTH failed, nothing loaded at all from either — the one case
            where the whole tab has genuinely nothing to show, so it gets
            the full-panel error treatment.
          */}
          {notesQuery.isError && voiceQuery.isError ? (
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

          {/*
            ONE source failed while the other has data (or is still
            resolving) — never hide what did load. A small inline notice
            per failed source, not a full-panel error, and each retries only
            its own query.
          */}
          {notesQuery.isError && !voiceQuery.isError ? (
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
          {voiceQuery.isError && !notesQuery.isError ? (
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

          {/*
            The confident "nothing shared with you yet" empty copy only
            renders once BOTH sources have genuinely SUCCEEDED with zero
            rows — if either is still loading or errored, we don't yet
            actually know that, so this step deliberately withholds it
            rather than asserting emptiness on partial information. Copy
            below is verbatim from the brief's §13.
          */}
          {notesQuery.isSuccess && voiceQuery.isSuccess && items.length === 0 ? (
            <div className="shared-notes__centre">
              <h2 className="shared-notes__empty-title">Nothing shared with you yet</h2>
              <p className="shared-notes__empty-body">
                When someone shares a note or voice note with you, it will appear here.
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
                    key={`voice-${String(item.voiceNote.voiceNoteId)}`}
                    shared={item.voiceNote}
                    ownerName={ownerNameFor(item.voiceNote.ownerId)}
                  />
                ),
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      {tab === 'notes' ? (
        <div id="shared-notes-panel-notes" role="tabpanel" aria-labelledby="shared-notes-tab-notes">
          {notesQuery.isLoading ? (
            <div className="shared-notes__centre">
              <Spinner label="Loading shared notes" />
            </div>
          ) : null}

          {notesQuery.isError ? (
            <div className="shared-notes__centre" role="alert">
              <p>Couldn&apos;t load your shared notes.</p>
              <button
                type="button"
                className="shared-notes__retry"
                onClick={() => void notesQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : null}

          {notesQuery.data && notesQuery.data.content.length === 0 ? (
            <div className="shared-notes__centre">
              <h2 className="shared-notes__empty-title">No shared notes yet</h2>
              <p className="shared-notes__empty-body">
                Notes shared with you will appear here.
              </p>
            </div>
          ) : null}

          {notesQuery.data && notesQuery.data.content.length > 0 ? (
            <ul className="shared-notes__list" role="list">
              {notesQuery.data.content.map((shared) => (
                <SharedNoteCard
                  key={shared.note.id}
                  shared={shared}
                  ownerName={ownerNameFor(shared.ownerId)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {tab === 'voice' ? (
        <div id="shared-notes-panel-voice" role="tabpanel" aria-labelledby="shared-notes-tab-voice">
          {voiceQuery.isLoading ? (
            <div className="shared-notes__centre">
              <Spinner label="Loading shared voice notes" />
            </div>
          ) : null}

          {voiceQuery.isError ? (
            <div className="shared-notes__centre" role="alert">
              <p>Couldn&apos;t load your shared voice notes.</p>
              <button
                type="button"
                className="shared-notes__retry"
                onClick={() => void voiceQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : null}

          {voiceQuery.data && voiceQuery.data.content.length === 0 ? (
            <div className="shared-notes__centre">
              <h2 className="shared-notes__empty-title">No shared voice notes yet</h2>
              <p className="shared-notes__empty-body">
                Voice notes shared with you will appear here.
              </p>
            </div>
          ) : null}

          {voiceQuery.data && voiceQuery.data.content.length > 0 ? (
            <ul className="shared-notes__list" role="list">
              {voiceQuery.data.content.map((shared) => (
                <SharedVoiceNoteCard
                  key={shared.voiceNoteId}
                  shared={shared}
                  ownerName={ownerNameFor(shared.ownerId)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/*
        Tab-aware, not a blanket "does anything anywhere have rows" check —
        `page` is shared lockstep across both queries (`sharedItems.ts`'s
        documented simplification), so Prev must stay reachable even when
        the CURRENT tab's page happens to be empty (e.g. page 2 of Notes has
        no rows but page 2 of Voice does) as long as we're not already on
        page 0 or the underlying data hasn't settled at all.
      */}
      {currentTabHasContent || page > 0 || hasMoreForTab ? (
        <div className="shared-notes__pager">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0 || isFetchingForTab}
            onClick={goToPreviousPage}
          >
            Previous
          </Button>
          {/*
            No "Page X of Y" — there is no reliable Y on either collection
            (this file's own doc comment on totalElements overcounting).
            `hasMoreForTab` is a correct "no more pages" signal regardless
            of what either (overcounted) total claims.
          */}
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasMoreForTab || isFetchingForTab}
            onClick={goToNextPage}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}

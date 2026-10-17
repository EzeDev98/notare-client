import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { useDrawerCounts } from '@/app/shell/useDrawerCounts';
import { useListView } from '@/app/shell/useNotesView';
import { useSessionUser } from '@/app/shell/useSessionUser';
import { SEARCH_DEBOUNCE_MS } from '@/core/config/timings';
import { ShareModal } from '@/features/collab/ShareModal/ShareModal';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { sectionsFor } from '@/features/notes/list/groupItems';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { useNoteList } from '@/features/notes/list/useNoteList';
import { publishVisibleOrder } from '@/features/notes/list/visibleOrder';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useNow } from '@/shared/hooks/useNow';

import { LeaveNoteModal } from './LeaveNoteModal';
import { ListBanners } from './ListBanners';
import { ListEmpty } from './ListEmpty';
import { ListHeader } from './ListHeader';
import { ListSearch } from './ListSearch';
import { NoteListRows } from './NoteListRows';
import { PeopleSection } from './PeopleSection';
import { useFirstLoad } from './useFirstLoad';
import { useKeepScroll } from './useKeepScroll';
import { useListActions } from './useListActions';
import { useRowChanges } from './useRowChanges';
import { useSearchScroll } from './useSearchScroll';

import './NotesListPane.css';

function OwnerList({ ownerId }: { ownerId: number }) {
  const view = useListView();
  // The typed text belongs to the view it was typed in; another view starts empty.
  const [typed, setTyped] = useState({ view, text: '' });
  const text = typed.view === view ? typed.text : '';
  const settled = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const term = text.trim() === '' ? '' : settled;
  const searching = term !== '';

  const items = useNoteList(view, ownerId, term);
  const counts = useDrawerCounts(ownerId);
  const now = useNow();
  const offline = useOffline();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const scroll = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  const rows = useRowChanges(inner, items);
  const sections = useMemo(
    () => (rows.shown ? sectionsFor(rows.shown, now, view !== 'deleted') : []),
    [rows.shown, now, view],
  );
  const order = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => item.id)),
    [sections],
  );
  useEffect(() => {
    publishVisibleOrder(
      view,
      sections.flatMap((section) =>
        section.items.map((item) => ({ id: item.id, path: item.path })),
      ),
    );
  }, [sections, view]);
  useEffect(() => {
    publishVisibleOrder(
      view,
      sections.flatMap((section) =>
        section.items.map((item) => ({ id: item.id, path: item.path })),
      ),
    );
  }, [sections, view]);
  useEffect(() => {
    publishVisibleOrder(
      view,
      sections.flatMap((section) =>
        section.items.map((item) => ({ id: item.id, path: item.path })),
      ),
    );
  }, [sections, view]);
  const { actions, leaving, cancelLeave, confirmLeave, sharing, closeShare } = useListActions({
    ownerId,
    view,
    openPath: pathname,
    rows,
    order,
  });
  useKeepScroll(scroll);
  const remember = useSearchScroll(scroll, searching, items);
  useFirstLoad(sections.length > 0, inner);

  return (
    <div ref={scroll} className="home__scroll">
      <div ref={inner} className="home__inner">
        <ListHeader
          title={LIST_COPY.titles[view]}
          count={searching ? counts[view] : rows.shown?.length}
        />
        <ListBanners view={view} />
        {view === 'shared' ? <PeopleSection /> : null}
        {view === 'deleted' ? null : (
          <ListSearch
            value={text}
            onChange={(value) => {
              if (text === '') remember();
              setTyped({ view, text: value });
            }}
          />
        )}
        {sections.length > 0 ? (
          <NoteListRows
            sections={sections}
            now={now}
            offline={offline}
            openPath={pathname}
            withMenu={view !== 'deleted'}
            actions={actions}
            onOpen={(item) => {
              void navigate(ROUTES.inView(item.path, view));
            }}
          />
        ) : null}
        {rows.shown?.length === 0 ? <ListEmpty view={view} term={term} /> : null}
        {sharing && sharing.item.serverId !== null ? (
          <ShareModal noteId={sharing.item.serverId} open={sharing.open} onClose={closeShare} />
        ) : null}
        {leaving ? (
          <LeaveNoteModal
            title={leaving.item.title}
            ownerName={leaving.item.ownerName}
            open={leaving.open}
            onCancel={cancelLeave}
            onConfirm={confirmLeave}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The list pane: title and count, search, then the rows. Empty states for the views arrive in 11h. */
export function NotesListPane() {
  const user = useSessionUser();
  return user ? <OwnerList ownerId={user.id} /> : null;
}

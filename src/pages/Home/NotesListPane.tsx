/** The list pane: title, count, search and rows. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useDrawerCounts } from '@/app/shell/useDrawerCounts';
import { useSessionUser } from '@/app/shell/useSessionUser';
import { SEARCH_DEBOUNCE_MS } from '@/core/config/timings';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { sectionsFor } from '@/features/notes/list/groupItems';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { useNoteList } from '@/features/notes/list/useNoteList';
import { publishVisibleOrder } from '@/features/notes/list/visibleOrder';
import { DeleteNoteModal } from '@/features/notes/components/DeleteNoteModal';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useNow } from '@/shared/hooks/useNow';

import { ListBanners } from './ListBanners';
import { ListEmpty } from './ListEmpty';
import { ListHeader } from './ListHeader';
import { ListSearch } from './ListSearch';
import { NoteListRows } from './NoteListRows';
import { useFirstLoad } from './useFirstLoad';
import { useKeepScroll } from './useKeepScroll';
import { useListActions } from './useListActions';
import { useRowChanges } from './useRowChanges';
import { useSearchScroll } from './useSearchScroll';

import './NotesListPane.css';

function OwnerList({ ownerId }: { ownerId: number }) {
  const [text, setText] = useState('');
  const settled = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const term = text.trim() === '' ? '' : settled;
  const searching = term !== '';

  const items = useNoteList(ownerId, term);
  const counts = useDrawerCounts(ownerId);
  const now = useNow();
  const offline = useOffline();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const scroll = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  const rows = useRowChanges(inner, items);
  const sections = useMemo(
    () => (rows.shown ? sectionsFor(rows.shown, now) : []),
    [rows.shown, now],
  );
  const order = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => item.id)),
    [sections],
  );
  useEffect(() => {
    publishVisibleOrder(
      sections.flatMap((section) =>
        section.items.map((item) => ({ id: item.id, path: item.path })),
      ),
    );
  }, [sections]);
  const { actions, deleteModal } = useListActions({
    ownerId,
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
          title={LIST_COPY.title}
          count={searching ? counts.all : rows.shown?.length}
        />
        <ListBanners />
        <ListSearch
          value={text}
          onChange={(value) => {
            if (text === '') remember();
            setText(value);
          }}
        />
        {sections.length > 0 ? (
          <NoteListRows
            sections={sections}
            now={now}
            offline={offline}
            openPath={pathname}
            actions={actions}
            onOpen={(item) => {
              void navigate(item.path);
            }}
          />
        ) : null}
        {rows.shown?.length === 0 ? <ListEmpty term={term} /> : null}
      </div>
      <DeleteNoteModal {...deleteModal} />
    </div>
  );
}

export function NotesListPane() {
  const user = useSessionUser();
  return user ? <OwnerList ownerId={user.id} /> : null;
}

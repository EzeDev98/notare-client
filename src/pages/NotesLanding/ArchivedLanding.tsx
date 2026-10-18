import { Archive, ArchiveRestore, Pin, Share, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Card,
  Icon,
  InfoBanner,
  ProgressBar,
  ScreenContainer,
  useToast,
} from '@/design-system/ui';
import { setArchived } from '@/features/notes/actions/noteActions';
import { LIST_COPY } from '@/features/notes/list/listContent';
import type { ListItem } from '@/features/notes/list/listItem';
import { useNoteList } from '@/features/notes/list/useNoteList';

import { LANDING_COPY } from './landingContent';
import './ViewLanding.css';

const COPY = LANDING_COPY.archived;
const MENU_ICONS = [Pin, Share, Archive, Trash2];
const ARCHIVE_AT = COPY.how.menu.indexOf('Archive');

/** Notes counted by the month they were last changed, newest month first. */
function byMonth(items: readonly ListItem[]): Array<{ key: string; label: string; count: number }> {
  const format = new Intl.DateTimeFormat(LIST_COPY.locale, { month: 'long', year: 'numeric' });
  const months = new Map<string, { at: number; label: string; count: number }>();
  for (const item of items) {
    const date = new Date(item.at);
    const key = `${String(date.getFullYear())}-${String(date.getMonth())}`;
    const seen = months.get(key);
    if (seen) seen.count += 1;
    else months.set(key, { at: item.at, label: format.format(date), count: 1 });
  }
  return [...months.entries()]
    .sort((a, b) => b[1].at - a[1].at)
    .map(([key, month]) => ({ key, label: month.label, count: month.count }));
}

/** The note pane on Archived: how to archive when it is empty, a summary and Unarchive all when it is not. */
export function ArchivedLanding({ ownerId }: { ownerId: number }) {
  const items = useNoteList('archived', ownerId, '');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (items === undefined) return null;

  const unarchiveAll = async (): Promise<void> => {
    setBusy(true);
    try {
      await Promise.all(items.map((item) => setArchived(item.id, false)));
      toast(COPY.unarchivedAll);
    } finally {
      setBusy(false);
    }
  };

  const empty = items.length === 0;
  const months = byMonth(items);
  const busiest = Math.max(1, ...months.map((month) => month.count));

  return (
    <ScreenContainer placement="top">
      <div className="vl">
        <p className="vl__lede">{empty ? COPY.lede : COPY.summary(items.length)}</p>

        {empty ? (
          <>
            <section className="vl__sec" aria-label={COPY.how.heading}>
              <h2 className="vl__h">{COPY.how.heading}</h2>
              <Card className="vl__pad">
                <div className="vl__sec">
                  <div className="vl__menu" aria-hidden="true">
                    {COPY.how.menu.map((label, index) => (
                      <div
                        key={label}
                        className={
                          index === ARCHIVE_AT ? 'vl__menu-item vl__menu-item--on' : 'vl__menu-item'
                        }
                      >
                        <Icon icon={MENU_ICONS[index] ?? Archive} />
                        {label}
                      </div>
                    ))}
                  </div>
                  <p className="vl__hint">{COPY.how.hint}</p>
                </div>
              </Card>
            </section>
            <InfoBanner>{COPY.never}</InfoBanner>
          </>
        ) : (
          <>
            <InfoBanner>{COPY.never}</InfoBanner>

            <section className="vl__sec" aria-label={COPY.months}>
              <h2 className="vl__h">{COPY.months}</h2>
              <Card className="vl__card">
                <ul className="vl__list">
                  {months.map((month) => (
                    <li key={month.key} className="vl__line">
                      <p className="vl__title">{month.label}</p>
                      <p className="vl__muted">{month.count}</p>
                      <ProgressBar value={(month.count / busiest) * 100} label={month.label} />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            <div className="vl__actions">
              <Button
                variant="secondary"
                busy={busy}
                onClick={() => {
                  void unarchiveAll();
                }}
              >
                <Icon icon={ArchiveRestore} />
                {COPY.unarchiveAll}
              </Button>
            </div>
            <p className="vl__hint">{COPY.hint}</p>
          </>
        )}
      </div>
    </ScreenContainer>
  );
}

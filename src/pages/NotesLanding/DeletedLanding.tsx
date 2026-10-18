import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { TRASH_DAYS } from '@/core/config/timings';
import {
  Button,
  Card,
  Icon,
  InfoBanner,
  ProgressBar,
  ScreenContainer,
  Tag,
  useToast,
} from '@/design-system/ui';
import { restoreNote } from '@/features/notes/actions/noteActions';
import { useTrash } from '@/features/notes/hooks/useTrash';
import { useNoteList } from '@/features/notes/list/useNoteList';
import { ConfirmModal } from '@/pages/Settings/ConfirmModal';
import { SETTINGS_COPY } from '@/pages/Settings/settingsContent';

import { DELETE_SOON_DAYS, LANDING_COPY } from './landingContent';
import './ViewLanding.css';

const COPY = LANDING_COPY.deleted;
const CONFIRM = SETTINGS_COPY.deleted.all;

/** The note pane on Recently deleted: what the bin does when it is empty, a removal schedule and bulk actions when it is not. */
export function DeletedLanding({ ownerId }: { ownerId: number }) {
  const items = useNoteList('deleted', ownerId, '');
  const { notes, deleteManyForever } = useTrash();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (items === undefined) return null;

  const restoreAll = async (): Promise<void> => {
    setBusy(true);
    try {
      await Promise.all(items.map((item) => restoreNote(item.id)));
      toast(COPY.restoredAll, { tone: 'success' });
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async (): Promise<undefined> => {
    if (notes) await deleteManyForever(notes);
    return undefined;
  };

  const empty = items.length === 0;
  const soonest = [...items].sort(
    (a, b) => (a.daysLeft ?? TRASH_DAYS) - (b.daysLeft ?? TRASH_DAYS),
  );

  return (
    <ScreenContainer placement="top">
      <div className="vl">
        <p className="vl__lede">{empty ? COPY.lede : COPY.summary(items.length)}</p>

        {empty ? (
          <>
            <section className="vl__sec" aria-label={COPY.timeline.heading}>
              <h2 className="vl__h">{COPY.timeline.heading}</h2>
              <Card className="vl__card vl__timeline">
                <span>{COPY.timeline.start}</span>
                <span className="vl__rail" aria-hidden="true" />
                <span>{COPY.timeline.end}</span>
              </Card>
            </section>
            <InfoBanner>{COPY.emptyNote}</InfoBanner>
          </>
        ) : (
          <>
            <InfoBanner>{COPY.note}</InfoBanner>

            <section className="vl__sec" aria-label={COPY.schedule}>
              <h2 className="vl__h">{COPY.schedule}</h2>
              <Card className="vl__card">
                <ul className="vl__list">
                  {soonest.map((item) => (
                    <li key={item.id} className="vl__line">
                      <p className="vl__title">{item.title}</p>
                      {item.daysLeft === null ? null : (
                        <Tag tone={item.daysLeft <= DELETE_SOON_DAYS ? 'brand' : 'neutral'}>
                          {COPY.daysLeft(item.daysLeft)}
                        </Tag>
                      )}
                      {item.daysLeft === null ? null : (
                        <ProgressBar
                          value={(item.daysLeft / TRASH_DAYS) * 100}
                          label={COPY.leftLabel(item.title)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            <div className="vl__actions">
              <Button
                variant="primary"
                busy={busy}
                onClick={() => {
                  void restoreAll();
                }}
              >
                <Icon icon={RotateCcw} />
                {COPY.restoreAll}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirming(true);
                }}
              >
                <Icon icon={Trash2} />
                {COPY.deleteAll}
              </Button>
            </div>
            <p className="vl__hint">{COPY.hint}</p>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirming}
        title={CONFIRM.title(items.length)}
        body={CONFIRM.body}
        confirmLabel={CONFIRM.confirm}
        danger
        onClose={() => {
          setConfirming(false);
        }}
        onConfirm={deleteAll}
      />
    </ScreenContainer>
  );
}

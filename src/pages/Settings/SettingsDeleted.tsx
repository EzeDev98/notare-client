import { MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Menu,
  PageHeader,
  ScreenContainer,
  Spinner,
} from '@/design-system/ui';
import { useTrash } from '@/features/notes/hooks/useTrash';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import type { NoteView } from '@/features/notes/local/noteMappers';
import { daysLeft } from '@/features/notes/local/trashRules';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useNow } from '@/shared/hooks/useNow';

import { ConfirmModal } from './ConfirmModal';
import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { useBackToHub } from './useBackToHub';

const COPY = SETTINGS_COPY.deleted;

type Pending = { kind: 'one'; note: NoteView } | { kind: 'all' } | null;

/** Settings > Recently deleted (master 6.6): 30 days in the bin, Restore, Delete forever. */
export function SettingsDeletedPage() {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const now = useNow();
  const { notes, restore, deleteForever, deleteManyForever } = useTrash();
  const [pending, setPending] = useState<Pending>(null);

  const confirmDelete = async (): Promise<undefined> => {
    if (pending?.kind === 'one') await deleteForever(pending.note);
    else if (pending?.kind === 'all' && notes) await deleteManyForever(notes);
    return undefined;
  };

  const count = notes?.length ?? 0;
  const modal =
    pending?.kind === 'one'
      ? {
          title: COPY.one.title,
          body: COPY.one.body(deriveNoteLabel(pending.note.content).label),
          confirm: COPY.one.confirm,
        }
      : { title: COPY.all.title(count), body: COPY.all.body, confirm: COPY.all.confirm };

  return (
    <ScreenContainer
      placement="top"
      bar={
        <PageHeader
          title={COPY.title}
          onBack={back}
          action={
            count > 0 ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setPending({ kind: 'all' });
                }}
              >
                {COPY.deleteAll}
              </Button>
            ) : undefined
          }
        />
      }
    >
      <div className="set__stack">
        {notes === undefined ? (
          <div className="set__spin">
            <Spinner />
          </div>
        ) : count === 0 ? (
          <EmptyState icon={Trash2} title={COPY.empty.title} description={COPY.empty.body} />
        ) : (
          <>
            <p className="set__note">{COPY.note}</p>
            <Card className="set__card">
              <ul className="set__list">
                {notes.map((note) => {
                  const label = deriveNoteLabel(note.content).label;
                  const left = daysLeft({ purgeAt: null, deletedAt: note.deletedAt }, now);
                  return (
                    <li key={note.localId} className="set__del">
                      <div className="set__del-main">
                        <p className="set__del-title">{label}</p>
                        {left === null ? null : <p className="set__del-sub">{COPY.daysLeft(left)}</p>}
                      </div>
                      <Menu
                        label={COPY.menu}
                        items={[
                          {
                            label: COPY.restore,
                            icon: RotateCcw,
                            onSelect: () => {
                              void restore(note);
                            },
                          },
                          'separator',
                          {
                            label: COPY.deleteForever,
                            icon: Trash2,
                            danger: true,
                            onSelect: () => {
                              setPending({ kind: 'one', note });
                            },
                          },
                        ]}
                      >
                        {({ triggerProps }) => (
                          <IconButton
                            icon={MoreHorizontal}
                            label={COPY.moreFor(label)}
                            {...triggerProps}
                          />
                        )}
                      </Menu>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </div>

      <ConfirmModal
        open={pending !== null}
        title={modal.title}
        body={modal.body}
        confirmLabel={modal.confirm}
        danger
        onClose={() => {
          setPending(null);
        }}
        onConfirm={confirmDelete}
      />
    </ScreenContainer>
  );
}

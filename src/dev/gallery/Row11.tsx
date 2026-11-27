/** Gallery row: NoteRow, ContextMenu, SelectionBar. */
import { MoreHorizontal } from 'lucide-react';

import { ContextMenu, IconButton, NoteRow, SelectionBar, useToast } from '@/design-system/ui';

import { Both } from './Both';

type Where = 'list' | 'editor';

const COMBOS: readonly { where: Where; label: string }[] = [
  { where: 'list', label: 'Note list' },
  { where: 'editor', label: 'Editor screen' },
];

export function Row11() {
  const toast = useToast();
  const say = (text: string) => () => {
    toast.show({ message: text });
  };

  return (
    <>
      <h2 className="gallery-group">Row 11: NoteRow, ContextMenu, SelectionBar</h2>

      <Both title="NoteRow: states (60 characters of title would truncate to one line)">
        <div className="n-list" role="listbox" aria-label="Notes">
          <p className="n-group-label">Pinned</p>
          <NoteRow title="Groceries for the weekend" preview="Rice, beans, tomatoes and plantain" date="10:42" pinned onOpen={say('Open')} />
          <p className="n-group-label">Earlier</p>
          <NoteRow title="Meeting notes" preview="Agenda for Monday's planning call" date="Yesterday" selected onOpen={say('Open')} />
          <NoteRow title="Voice memo" preview="Transcription is ready" date="Oct 2" voice />
          <NoteRow title="Offline draft" preview="Waiting to sync" date="Oct 1" notSynced />
          <NoteRow title="Trip ideas" preview="Matched in transcript: lagos to abuja" date="Sep 28" matchedInTranscript voice />
          <NoteRow title="" date="Sep 20" />
        </div>
      </Both>

      <Both title="NoteRow: with a menu at the end">
        <div className="n-list" role="listbox" aria-label="Notes with menu">
          <NoteRow
            title="Groceries for the weekend"
            preview="Rice, beans, tomatoes and plantain"
            date="10:42"
            menu={
              <ContextMenu where="list" onPin={say('Pin')} onMakeCopy={say('Make a copy')} onDelete={say('Delete')}>
                {({ triggerProps }) => <IconButton icon={MoreHorizontal} label="Note actions" {...triggerProps} />}
              </ContextMenu>
            }
          />
        </div>
      </Both>

      <Both title="ContextMenu: on both screens (open each one)">
        <div className="gallery-stack">
          {COMBOS.map(({ where, label }) => (
            <div className="gallery-row" key={label}>
              <ContextMenu
                where={where}
                onPin={say('Pin')}
                onCopyText={say('Copy as text')}
                onMakeCopy={say('Make a copy')}
                onDelete={say('Delete')}
              >
                {({ triggerProps }) => <IconButton icon={MoreHorizontal} label={label} {...triggerProps} />}
              </ContextMenu>
              <span className="gallery-muted">{label}</span>
            </div>
          ))}
          <div className="gallery-row">
            <ContextMenu where="list" pinned onPin={say('Unpin')}>
              {({ triggerProps }) => <IconButton icon={MoreHorizontal} label="Pinned" {...triggerProps} />}
            </ContextMenu>
            <span className="gallery-muted">Pinned (Unpin)</span>
          </div>
        </div>
      </Both>

      <Both title="SelectionBar">
        <div className="gallery-row">
          <SelectionBar onLink={say('Link')} onList={say('List')} />
          <SelectionBar listActive onLink={say('Link')} onList={say('List')} />
        </div>
        <div className="gallery-gap" />
        <div className="gallery-selbar-demo">
          <p className="gallery-text">Floating over text, never pushing it down.</p>
          <SelectionBar position={{ top: 0, left: 120 }} onLink={say('Link')} onList={say('List')} />
        </div>
      </Both>
    </>
  );
}

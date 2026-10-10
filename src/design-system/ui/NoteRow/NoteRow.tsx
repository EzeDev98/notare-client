import { CloudOff, Mic, Pin, Users } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';

import './NoteRow.css';

interface NoteRowProps {
  /** Empty shows "Untitled". */
  title: string;
  /** Empty shows "No more text". */
  preview?: string | undefined;
  date: string;
  selected?: boolean | undefined;
  pinned?: boolean | undefined;
  shared?: boolean | undefined;
  voice?: boolean | undefined;
  notSynced?: boolean | undefined;
  /** The search matched the transcript, not the text: the preview says so. */
  matchedInTranscript?: boolean | undefined;
  /** Recently deleted: shows the days left and a Restore button instead of the date and glyphs. */
  deleted?: { daysLeft: number; onRestore: () => void } | undefined;
  onOpen?: (() => void) | undefined;
  /** A ContextMenu trigger, drawn at the end of the row. */
  menu?: ReactNode;
}

/** A 64px note row: title (16px), one-line preview (14px muted), date and 14px glyphs on the right. */
export function NoteRow({
  title,
  preview,
  date,
  selected = false,
  pinned,
  shared,
  voice,
  notSynced,
  matchedInTranscript,
  deleted,
  onOpen,
  menu,
}: NoteRowProps) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    // Buttons and menus inside the row do their own thing.
    if (event.target instanceof Element && event.target.closest('button, a')) return;
    onOpen?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen?.();
    }
  };

  return (
    <div className="n-row" role="option" tabIndex={0} aria-selected={selected} onClick={handleClick} onKeyDown={handleKeyDown}>
      <div className="n-row__text">
        <span className="n-row__title">{title || 'Untitled'}</span>
        <span className="n-row__preview">{matchedInTranscript ? 'Matched in transcript' : preview || 'No more text'}</span>
      </div>
      {deleted ? (
        <>
          <div className="n-row__meta">
            <span>{`${String(deleted.daysLeft)} ${deleted.daysLeft === 1 ? 'day' : 'days'} left`}</span>
          </div>
          <Button variant="secondary" onClick={deleted.onRestore}>
            Restore
          </Button>
        </>
      ) : (
        <div className="n-row__meta">
          <span>{date}</span>
          <span className="n-row__glyphs">
            {notSynced ? <Icon icon={CloudOff} label="Not synced" /> : null}
            {pinned ? <Icon icon={Pin} label="Pinned" /> : null}
            {voice ? <Icon icon={Mic} label="Has a voice clip" /> : null}
            {shared ? <Icon icon={Users} label="Shared" /> : null}
          </span>
        </div>
      )}
      {menu}
    </div>
  );
}

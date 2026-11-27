import { CloudOff, Mic, Pin } from 'lucide-react';
import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';

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
  voice?: boolean | undefined;
  notSynced?: boolean | undefined;
  /** The search matched the transcript, not the text: the preview says so. */
  matchedInTranscript?: boolean | undefined;
  onOpen?: (() => void) | undefined;
  /** A ContextMenu trigger, drawn at the end of the row. */
  menu?: ReactNode;
  /** Extra handlers for the row itself, for example right-click and long-press. */
  rootProps?: Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'role' | 'tabIndex' | 'children' | 'onClick' | 'onKeyDown'> | undefined;
}

/** A 64px note row: title (16px), one-line preview (14px muted), date and 14px glyphs on the right. */
export function NoteRow({
  title,
  preview,
  date,
  selected = false,
  pinned,
  voice,
  notSynced,
  matchedInTranscript,
  onOpen,
  menu,
  rootProps,
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
    <div {...rootProps} className="n-row" role="option" tabIndex={0} aria-selected={selected} onClick={handleClick} onKeyDown={handleKeyDown}>
      <div className="n-row__text">
        <span className="n-row__title">{title || 'Untitled'}</span>
        <span className="n-row__preview">{matchedInTranscript ? 'Matched in transcript' : preview || 'No more text'}</span>
      </div>
      <div className="n-row__meta">
        <span>{date}</span>
        <span className="n-row__glyphs">
          {notSynced ? <Icon icon={CloudOff} label="Not synced" /> : null}
          {pinned ? <Icon icon={Pin} label="Pinned" /> : null}
          {voice ? <Icon icon={Mic} label="Has a voice clip" /> : null}
        </span>
      </div>
      {menu}
    </div>
  );
}

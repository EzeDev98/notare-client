/** One note in the list. */
import { CloudOff, Mic, Pin } from 'lucide-react';
import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { Icon } from '../Icon/Icon';

import './NoteRow.css';

interface NoteRowProps {
  title: string;
  preview?: string | undefined;
  date: string;
  selected?: boolean | undefined;
  pinned?: boolean | undefined;
  voice?: boolean | undefined;
  notSynced?: boolean | undefined;
  matchedInTranscript?: boolean | undefined;
  onOpen?: (() => void) | undefined;
  menu?: ReactNode;
  rootProps?: Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'role' | 'tabIndex' | 'children' | 'onClick' | 'onKeyDown'> | undefined;
}

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

import { Link2, List } from 'lucide-react';

import { IconButton } from '../IconButton/IconButton';

import './SelectionBar.css';

interface SelectionBarProps {
  onLink?: (() => void) | undefined;
  onList?: (() => void) | undefined;
  /** True when the selection is already a list item. */
  listActive?: boolean | undefined;
  /** Floats at this spot inside a positioned parent, over the text, never pushing it. */
  position?: { top: number; left: number } | undefined;
}

/** The small bar over selected text: Link and List only. Pressing it keeps the selection. */
export function SelectionBar({ onLink, onList, listActive, position }: SelectionBarProps) {
  return (
    <div
      className={position ? 'n-selbar n-selbar--floating' : 'n-selbar'}
      role="toolbar"
      aria-label="Format"
      style={position}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      <IconButton icon={Link2} label="Link" onClick={onLink} />
      <IconButton icon={List} label="List" pressed={listActive} onClick={onList} />
    </div>
  );
}

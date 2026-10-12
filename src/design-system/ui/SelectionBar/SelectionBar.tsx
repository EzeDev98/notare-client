import { Link2, List } from 'lucide-react';
import type { KeyboardEvent, Ref } from 'react';

import { Button } from '../Button/Button';
import { Control } from '../Control/Control';
import { IconButton } from '../IconButton/IconButton';

import './SelectionBar.css';

interface LinkField {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

interface SelectionBarProps {
  onLink?: (() => void) | undefined;
  onList?: (() => void) | undefined;
  /** True when the selection is already a list item. */
  listActive?: boolean | undefined;
  /** Floats at this spot inside a positioned parent, over the text, never pushing it. */
  position?: { top: number; left: number } | undefined;
  /** Floats like `position`, but the caller sets top and left on the element itself (through `ref`). */
  floating?: boolean | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
  /** Replaces the buttons with "Paste a link" and Apply, in the same bar. */
  linkField?: LinkField | undefined;
}

/** The small bar over selected text: Link and List only. Pressing it keeps the selection. */
export function SelectionBar({
  onLink,
  onList,
  listActive,
  position,
  floating,
  ref,
  linkField,
}: SelectionBarProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!linkField) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      linkField.onApply();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      linkField.onCancel();
    }
  };

  return (
    <div
      ref={ref}
      className={position || floating ? 'n-selbar n-selbar--floating' : 'n-selbar'}
      role="toolbar"
      aria-label="Format"
      style={position}
      // The buttons must not take focus from the text. The link field must be able to.
      onMouseDown={
        linkField
          ? undefined
          : (event) => {
              event.preventDefault();
            }
      }
    >
      {linkField ? (
        <>
          <Control>
            <input
              className="ui-control__input"
              type="text"
              inputMode="url"
              placeholder="Paste a link"
              aria-label="Link address"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={linkField.value}
              onChange={(event) => {
                linkField.onChange(event.target.value);
              }}
              onKeyDown={handleKeyDown}
            />
          </Control>
          <Button variant="secondary" onClick={linkField.onApply}>
            Apply
          </Button>
        </>
      ) : (
        <>
          <IconButton icon={Link2} label="Link" onClick={onLink} />
          <IconButton icon={List} label="List" pressed={listActive} onClick={onList} />
        </>
      )}
    </div>
  );
}

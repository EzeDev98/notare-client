/** The bar shown over selected text in a note. */
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
  listActive?: boolean | undefined;
  position?: { top: number; left: number } | undefined;
  floating?: boolean | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
  linkField?: LinkField | undefined;
}

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

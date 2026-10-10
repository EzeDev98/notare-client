import { Check } from 'lucide-react';

import { Icon } from '../Icon/Icon';
import '../Menu/Menu.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
  selected: boolean;
}

interface SelectListProps {
  id: string;
  options: readonly SelectOption[];
  active: number;
  onActive: (index: number) => void;
  onPick: (index: number) => void;
}

/** The open list of a SelectField, drawn from tokens. Focus stays on the real select. */
export function SelectList({ id, options, active, onActive, onPick }: SelectListProps) {
  return (
    <div className="n-menu" role="listbox" id={id}>
      {options.map((option, index) => (
        <button
          key={`${option.value}-${String(index)}`}
          type="button"
          tabIndex={-1}
          role="option"
          id={`${id}-${String(index)}`}
          className="n-menu__item"
          aria-selected={option.selected}
          aria-disabled={option.disabled || undefined}
          data-active={index === active ? '' : undefined}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onMouseMove={() => {
            if (!option.disabled) onActive(index);
          }}
          onClick={() => {
            if (!option.disabled) onPick(index);
          }}
        >
          {option.label}
          {option.selected ? <Icon icon={Check} className="n-menu__tick" /> : null}
        </button>
      ))}
    </div>
  );
}

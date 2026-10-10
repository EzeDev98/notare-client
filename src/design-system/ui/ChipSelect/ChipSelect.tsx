import { useId } from 'react';

import '../FormField/FormField.css';
import './ChipSelect.css';

interface ChipSelectProps {
  label: string;
  /** Radios in one group. Pass a name that is unique on the screen. */
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
}

/** Single choice shown as chips. The chosen one is filled. Arrow keys move between chips. */
export function ChipSelect({ label, name, options, value, onChange, disabled = false }: ChipSelectProps) {
  const labelId = useId();
  return (
    <div className="ui-form-field">
      <span id={labelId} className="ui-form-field__label">
        {label}
      </span>
      <div className="ui-chips" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => (
          <label key={option.value} className="ui-chip">
            <input
              className="ui-chip__input"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span className="ui-chip__label">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

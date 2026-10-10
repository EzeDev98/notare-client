import type { ChangeEvent, ClipboardEvent, FocusEvent, KeyboardEvent } from 'react';
import { useRef } from 'react';

import { FormField } from '../FormField/FormField';

import './OtpField.css';

interface OtpFieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** The digits typed so far, for example "123". */
  value: string;
  onChange: (value: string) => void;
  /** Called once when all boxes are filled. */
  onComplete?: (value: string) => void;
  /** 6 for a code, 4 (with `masked`) for the PIN. */
  length?: number;
  masked?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * One box per digit. Supports typing, paste (also the browser's one-time-code
 * autofill into the first box), Backspace, and Left/Right arrows.
 */
export function OtpField({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  onComplete,
  length = 6,
  masked = false,
  disabled = false,
  autoFocus = false,
  className,
}: OtpFieldProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number) => {
    boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  };

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length && next !== value) onComplete?.(next);
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '');
    if (!digits) return;
    const incoming = value[index] && digits.length === 2 ? digits.slice(-1) : digits;
    const single = incoming.length === 1;
    const next = (single
      ? value.slice(0, index) + incoming + value.slice(index + 1)
      : value.slice(0, index) + incoming
    ).slice(0, length);
    commit(next);
    focusBox(single ? index + 1 : next.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
        focusBox(index);
      } else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        focusBox(index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    event.preventDefault();
    const next = (value.slice(0, index) + digits).slice(0, length);
    commit(next);
    focusBox(next.length);
  };

  const handleFocus = (index: number, event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
    if (index > value.length) focusBox(value.length);
  };

  return (
    <FormField label={label} hint={hint} error={error} optional={optional} className={className}>
      {(a11y) => (
        <div className="ui-otp" role="group" aria-label={label}>
          {Array.from({ length }, (_, index) => (
            <input
              key={String(index)}
              ref={(element) => {
                boxes.current[index] = element;
              }}
              id={index === 0 ? a11y.id : undefined}
              className={['ui-otp__box', masked && 'ui-otp__box--masked', error && 'ui-otp__box--invalid']
                .filter(Boolean)
                .join(' ')}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoFocus={autoFocus && index === 0}
              disabled={disabled}
              aria-label={`Digit ${String(index + 1)} of ${String(length)}`}
              aria-describedby={a11y['aria-describedby']}
              aria-invalid={a11y['aria-invalid']}
              value={value[index] ?? ''}
              onChange={(event) => {
                handleChange(index, event);
              }}
              onKeyDown={(event) => {
                handleKeyDown(index, event);
              }}
              onPaste={(event) => {
                handlePaste(index, event);
              }}
              onFocus={(event) => {
                handleFocus(index, event);
              }}
            />
          ))}
        </div>
      )}
    </FormField>
  );
}

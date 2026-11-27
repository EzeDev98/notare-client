/** A select field. */
import { ChevronDown } from 'lucide-react';
import { useId, useRef, useState, type ComponentPropsWithRef, type KeyboardEvent, type MouseEvent } from 'react';

import { Control } from '../Control/Control';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { Popover } from '../Popover/Popover';

import { SelectList, type SelectOption } from './SelectList';

import './SelectField.css';

type SelectFieldProps = Omit<ComponentPropsWithRef<'select'>, 'id'> & {
  label: string;
  hideLabel?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  placeholder?: string | undefined;
  submitting?: boolean | undefined;
};

export function SelectField({
  label,
  hideLabel,
  hint,
  error,
  optional,
  placeholder,
  submitting = false,
  disabled,
  className,
  children,
  ref,
  ...rest
}: SelectFieldProps) {
  const listId = useId();
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const controlRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [active, setActive] = useState(0);
  const locked = submitting || Boolean(disabled);

  const defaultValue = rest.value !== undefined ? undefined : (rest.defaultValue ?? (placeholder ? '' : undefined));

  const setRefs = (element: HTMLSelectElement | null) => {
    selectRef.current = element;
    controlRef.current = element?.closest<HTMLElement>('.ui-control') ?? null;
    if (typeof ref === 'function') ref(element);
    else if (ref) ref.current = element;
  };

  const openList = () => {
    const select = selectRef.current;
    if (!select || locked) return;
    setOptions(
      Array.from(select.options, (option) => ({
        value: option.value,
        label: option.text,
        disabled: option.disabled,
        selected: option.selected && !option.disabled,
      })),
    );
    setActive(Math.max(0, select.selectedIndex));
    setOpen(true);
  };

  const pick = (index: number) => {
    const select = selectRef.current;
    const option = options[index];
    if (!select || !option || option.disabled) return;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
    select.focus();
  };

  const move = (step: 1 | -1) => {
    setActive((current) => {
      let next = current;
      for (let count = 0; count < options.length; count += 1) {
        next = (next + step + options.length) % options.length;
        if (!options[next]?.disabled) return next;
      }
      return current;
    });
  };

  const handleMouseDown = (event: MouseEvent<HTMLSelectElement>) => {
    rest.onMouseDown?.(event);
    if (locked) return;
    event.preventDefault();
    event.currentTarget.focus();
    if (open) setOpen(false);
    else openList();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSelectElement>) => {
    rest.onKeyDown?.(event);
    if (locked) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <FormField label={label} hideLabel={hideLabel} hint={hint} error={error} optional={optional} className={className}>
      {(a11y) => (
        <Control invalid={Boolean(error)} disabled={disabled} readOnly={submitting}>
          <select
            {...rest}
            {...a11y}
            ref={setRefs}
            defaultValue={defaultValue}
            className="ui-control__input ui-select__input"
            disabled={disabled}
            aria-readonly={submitting || undefined}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? `${listId}-${String(active)}` : undefined}
            tabIndex={submitting ? -1 : rest.tabIndex}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {children}
          </select>
          <Icon icon={ChevronDown} className="ui-select__chevron" />
          <Popover
            open={open}
            onClose={() => {
              setOpen(false);
            }}
            anchorRef={controlRef}
            match="anchor"
          >
            <SelectList id={listId} options={options} active={active} onActive={setActive} onPick={pick} />
          </Popover>
        </Control>
      )}
    </FormField>
  );
}

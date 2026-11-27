/** Shared markup for Checkbox and Radio. */
import { Check } from 'lucide-react';
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';

import { Icon } from '../Icon/Icon';

import './Choice.css';

export type ChoiceProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'children'> & {
  label: ReactNode;
  hint?: string;
};

export function Choice({
  kind,
  label,
  hint,
  disabled,
  className,
  ...rest
}: ChoiceProps & { kind: 'checkbox' | 'radio' }) {
  const hintId = useId();
  const classes = [
    'ui-choice',
    `ui-choice--${kind}`,
    disabled && 'ui-choice--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={classes}>
      <span className="ui-choice__control">
        <input
          {...rest}
          type={kind}
          disabled={disabled}
          className="ui-choice__input"
          aria-describedby={hint ? hintId : undefined}
        />
        <span className="ui-choice__box">
          {kind === 'checkbox' ? <Icon icon={Check} className="ui-choice__tick" /> : null}
        </span>
      </span>
      <span>
        <span className="ui-choice__label">{label}</span>
        {hint ? (
          <span id={hintId} className="ui-choice__hint">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

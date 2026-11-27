/** A row that opens another screen: a label, an optional value and a chevron. */
import { ChevronRight } from 'lucide-react';

import { Icon } from '../Icon/Icon';
import './LinkRow.css';

interface LinkRowProps {
  label: string;
  value?: string | undefined;
  onSelect: () => void;
}

export function LinkRow({ label, value, onSelect }: LinkRowProps) {
  return (
    <li>
      <button type="button" className="ui-link-row" onClick={onSelect}>
        <span className="ui-link-row__label">{label}</span>
        <span className="ui-link-row__value">{value ?? ''}</span>
        <Icon icon={ChevronRight} className="ui-link-row__chev" />
      </button>
    </li>
  );
}

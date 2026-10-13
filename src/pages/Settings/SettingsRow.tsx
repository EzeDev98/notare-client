import { ChevronRight } from 'lucide-react';

import { Icon } from '@/design-system/ui';

interface SettingsRowProps {
  label: string;
  /** Muted, at the right. Left out when the row has no value. */
  value?: string | undefined;
  onSelect: () => void;
}

/** One 40px row of a Settings list: label, muted value, chevron. */
export function SettingsRow({ label, value, onSelect }: SettingsRowProps) {
  return (
    <li>
      <button type="button" className="set__row" onClick={onSelect}>
        <span>{label}</span>
        <span className="set__value">{value ?? ''}</span>
        <Icon icon={ChevronRight} className="set__chev" />
      </button>
    </li>
  );
}

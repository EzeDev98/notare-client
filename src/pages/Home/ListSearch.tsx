import { Search, X } from 'lucide-react';

import { Icon, IconButton, TextField } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

interface ListSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/** The 40px search field: icon on the left, an x to clear on the right. No spinner, no floating panel. */
export function ListSearch({ value, onChange }: ListSearchProps) {
  return (
    <TextField
      label={LIST_COPY.search.label}
      hideLabel
      type="search"
      placeholder={LIST_COPY.search.placeholder}
      autoComplete="off"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      leading={<Icon icon={Search} />}
      trailing={
        value === '' ? undefined : (
          <IconButton
            icon={X}
            label={LIST_COPY.search.clear}
            onClick={() => {
              onChange('');
            }}
          />
        )
      }
    />
  );
}

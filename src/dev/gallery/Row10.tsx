/** Gallery row: Menu and the select list. */
import { Copy, Ellipsis, Mic, Pin, Plus, Trash2 } from 'lucide-react';

import { IconButton, Menu, SelectField, useToast } from '@/design-system/ui';

export function Row10() {
  const toast = useToast();
  const chose = (name: string) => () => {
    toast.show({ message: `Chose ${name}` });
  };

  return (
    <>
      <h2 className="gallery-group">Row 10: Menu, Select popup</h2>
      <section className="gallery-section">
        <h2 className="gallery-section__title">
          Menus follow the Theme toggle. Arrow keys move, Enter chooses, Escape closes and returns focus.
        </h2>
        <div className="gallery-row">
          <Menu
            label="Insert"
            items={[
              { label: 'Voice clip', icon: Mic, onSelect: chose('Voice clip') },
            ]}
          >
            {({ triggerProps }) => <IconButton icon={Plus} label="Insert" {...triggerProps} />}
          </Menu>
          <Menu
            label="More"
            items={[
              { label: 'Pin', icon: Pin, onSelect: chose('Pin') },
              { label: 'Copy as text', icon: Copy, onSelect: chose('Copy as text') },
              'separator',
              { label: 'Delete', icon: Trash2, onSelect: chose('Delete') },
              { label: 'Disabled item', icon: Pin, onSelect: chose('Disabled'), disabled: true },
            ]}
          >
            {({ triggerProps }) => <IconButton icon={Ellipsis} label="More" {...triggerProps} />}
          </Menu>
        </div>
      </section>
      <section className="gallery-section">
        <h2 className="gallery-section__title">Select popup (the closed control is the normal SelectField)</h2>
        <div className="gallery-stack">
          <SelectField label="Sort notes by" defaultValue="updated">
            <option value="updated">Last updated</option>
            <option value="created">Date created</option>
            <option value="title">Title</option>
            <option value="size">Length</option>
            <option value="pinned">Pinned first</option>
          </SelectField>
        </div>
      </section>
    </>
  );
}

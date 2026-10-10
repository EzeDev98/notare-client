import { Bell, Pin, Settings } from 'lucide-react';

import { Button, IconButton, Link } from '@/design-system/ui';

import { Both } from './Both';

/** Gallery: row 2, Button, IconButton, Link. */
export function Row2() {
  return (
    <>
      <h2 className="gallery-group">Row 2: Button, IconButton, Link</h2>
      <Both title="Button: variants">
        <div className="gallery-row">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
        </div>
      </Both>
      <Both title="Button: disabled">
        <div className="gallery-row">
          <Button variant="primary" disabled>Primary</Button>
          <Button disabled>Secondary</Button>
          <Button variant="ghost" disabled>Ghost</Button>
          <Button variant="danger" disabled>Delete</Button>
        </div>
      </Both>
      <Both title="Button: busy (same width as normal)">
        <div className="gallery-row">
          <Button variant="primary">Save changes</Button>
          <Button variant="primary" busy>Save changes</Button>
          <Button busy>Cancel</Button>
        </div>
      </Both>
      <Both title="Button: block (42px)">
        <div className="gallery-stack">
          <Button variant="primary" block>Continue</Button>
          <Button variant="primary" block busy>Continue</Button>
        </div>
      </Both>
      <Both title="IconButton">
        <div className="gallery-row">
          <IconButton icon={Bell} label="Notifications" />
          <IconButton icon={Bell} label="Notifications" badge={3} />
          <IconButton icon={Pin} label="Pin" pressed />
          <IconButton icon={Pin} label="Pin" pressed={false} />
          <IconButton icon={Settings} label="Settings" disabled />
        </div>
      </Both>
      <Both title="Link">
        <p className="gallery-text">
          Read the <Link to="/dev/tokens">tokens page</Link> or <Link to="https://example.com">an outside site</Link>.
        </p>
      </Both>
    </>
  );
}

/** Gallery row: Icon, Spinner, VisuallyHidden, Logo. */
import { Bell, Pin, Plus, Settings } from 'lucide-react';

import { Icon, Logo, Spinner, VisuallyHidden } from '@/design-system/ui';

import { Both } from './Both';

export function Row1() {
  return (
    <>
      <h2 className="gallery-group">Row 1: Icon, Spinner, VisuallyHidden, Logo</h2>
      <Both title="Icon (18px, stroke 1.4)">
        <div className="gallery-row">
          <Icon icon={Bell} label="Notifications" />
          <Icon icon={Settings} />
          <Icon icon={Pin} />
          <span className="gallery-muted">
            <Icon icon={Plus} />
          </span>
        </div>
      </Both>
      <Both title="Spinner">
        <div className="gallery-row">
          <Spinner />
          <Spinner size="sm" />
          <span className="gallery-muted">
            <Spinner label="Saving" />
          </span>
        </div>
      </Both>
      <Both title="VisuallyHidden">
        <p className="gallery-text">
          Nothing is drawn between the brackets, but a screen reader says it: [<VisuallyHidden>Hidden text</VisuallyHidden>]
        </p>
      </Both>
      <Both title="Logo (md 32px, lg 72px)">
        <div className="gallery-row">
          <Logo scheme="light" label="Notare" />
          <Logo scheme="dark" label="Notare" />
          <Logo size="lg" scheme="light" label="Notare" />
          <Logo size="lg" scheme="dark" label="Notare" />
        </div>
      </Both>
    </>
  );
}

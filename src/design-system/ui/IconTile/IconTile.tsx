/** An icon on a rounded tile. */
import type { LucideIcon } from 'lucide-react';

import { Icon } from '../Icon/Icon';

import './IconTile.css';

export function IconTile({ icon }: { icon: LucideIcon }) {
  return (
    <span className="ui-emoji-tile" aria-hidden="true">
      <Icon icon={icon} />
    </span>
  );
}

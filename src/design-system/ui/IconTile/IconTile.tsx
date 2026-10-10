import type { LucideIcon } from 'lucide-react';

import { Icon } from '../Icon/Icon';

import './IconTile.css';

/** A 40px rounded tile with a brand-coloured icon, used on the onboarding cards. Decorative. */
export function IconTile({ icon }: { icon: LucideIcon }) {
  return (
    <span className="ui-emoji-tile" aria-hidden="true">
      <Icon icon={icon} />
    </span>
  );
}

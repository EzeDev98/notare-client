/** An empty state with an icon, heading and line. */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '../Icon/Icon';

import './EmptyState.css';

interface EmptyStateProps {
  icon?: LucideIcon | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      {icon ? <Icon icon={icon} className="ui-empty__icon" /> : null}
      <p className="ui-empty__title">{title}</p>
      {description ? <p className="ui-empty__description">{description}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '../Icon/Icon';

import './EmptyState.css';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string | undefined;
  /** Optional button, for example "New note". */
  action?: ReactNode;
}

/** Icon, title (16px), muted description (14px) and an optional button. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <Icon icon={icon} className="ui-empty__icon" />
      <p className="ui-empty__title">{title}</p>
      {description ? <p className="ui-empty__description">{description}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  /** Shows a Back button that calls this. */
  onBack?: (() => void) | undefined;
  /** One control on the right, for example a button. */
  action?: ReactNode;
}

/** The 56px bar at the top of a screen: optional Back, the title (20px, one line), one action. */
export function PageHeader({ title, onBack, action }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      {onBack ? <IconButton icon={ChevronLeft} label="Back" className="ui-page-header__back" onClick={onBack} /> : null}
      <h1 className="ui-page-header__title">{title}</h1>
      {action ? <div className="ui-page-header__action">{action}</div> : null}
    </header>
  );
}

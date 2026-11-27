/** A screen's top bar with an optional Back button. */
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  onBack?: (() => void) | undefined;
  action?: ReactNode;
}

export function PageHeader({ title, onBack, action }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      {onBack ? <IconButton icon={ArrowLeft} label="Back" className="ui-page-header__back" onClick={onBack} /> : null}
      <h1 className="ui-page-header__title">{title}</h1>
      {action ? <div className="ui-page-header__action">{action}</div> : null}
    </header>
  );
}

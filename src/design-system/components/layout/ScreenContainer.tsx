/** The container for a whole screen. */
import type { ReactNode } from 'react';

import './ScreenContainer.css';

interface ScreenContainerProps {
  bar?: ReactNode;
  placement?: 'center' | 'top' | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function ScreenContainer({ bar, placement = 'center', className, children }: ScreenContainerProps) {
  return (
    <div className={className ? `ui-screen ${className}` : 'ui-screen'}>
      <div className="ui-screen__inner">
        {bar ? <div className="ui-screen__bar">{bar}</div> : null}
        <div className={placement === 'top' ? 'ui-screen__group ui-screen__group--top' : 'ui-screen__group'}>
          {children}
        </div>
      </div>
    </div>
  );
}

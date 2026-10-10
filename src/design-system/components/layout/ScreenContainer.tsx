import type { ReactNode } from 'react';

import './ScreenContainer.css';

interface ScreenContainerProps {
  /** Content for the top bar (a PageHeader, or a Back button). */
  bar?: ReactNode;
  /** center: the content group sits in the vertical middle. top: it starts under the bar. */
  placement?: 'center' | 'top' | undefined;
  children: ReactNode;
}

/**
 * The one 500px column. Content and actions are one group, centred vertically
 * by default. This and FormScreen are the only places that position a screen vertically.
 */
export function ScreenContainer({ bar, placement = 'center', children }: ScreenContainerProps) {
  return (
    <div className="ui-screen">
      <div className="ui-screen__inner">
        {bar ? <div className="ui-screen__bar">{bar}</div> : null}
        <div className={placement === 'top' ? 'ui-screen__group ui-screen__group--top' : 'ui-screen__group'}>
          {children}
        </div>
      </div>
    </div>
  );
}

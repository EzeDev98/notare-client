/** An information or error banner. */
import { CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '../Icon/Icon';

import './InfoBanner.css';

interface InfoBannerProps {
  tone?: 'brand' | 'error' | undefined;
  title?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
}

export function InfoBanner({ tone = 'brand', title, action, children }: InfoBannerProps) {
  const error = tone === 'error';
  return (
    <div className={error ? 'ui-banner ui-banner--error' : 'ui-banner'} role={error ? 'alert' : 'status'}>
      <Icon icon={error ? CircleAlert : Info} className="ui-banner__icon" />
      <div className="ui-banner__text">
        {title ? (
          <>
            <p className="ui-banner__title">{title}</p>
            <p className="ui-banner__body">{children}</p>
          </>
        ) : (
          <p>{children}</p>
        )}
      </div>
      {action ? <div className="ui-banner__action">{action}</div> : null}
    </div>
  );
}

import { CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '../Icon/Icon';

import './InfoBanner.css';

interface InfoBannerProps {
  /** brand for information, error for something that went wrong. */
  tone?: 'brand' | 'error' | undefined;
  title?: string | undefined;
  /** Optional button, for example "Retry". */
  action?: ReactNode;
  children: ReactNode;
}

/** Message bar with an icon, an optional title and an optional action. Also replaces FormAlert. */
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

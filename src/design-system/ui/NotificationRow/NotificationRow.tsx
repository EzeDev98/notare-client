import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '../IconButton/IconButton';

import './NotificationRow.css';

interface NotificationRowProps {
  text: string;
  /** For example "2 min ago" or "Weekend plan · Yesterday". */
  meta?: string | undefined;
  /** Unread rows show a brand dot. Default true. */
  unread?: boolean | undefined;
  onDismiss?: (() => void) | undefined;
  /** Buttons such as Accept and Decline, drawn on their own line, right-aligned. */
  actions?: ReactNode;
}

/** One notification: dot, text, time, a dismiss button, and optional actions. */
export function NotificationRow({ text, meta, unread = true, onDismiss, actions }: NotificationRowProps) {
  return (
    <div className="n-notice">
      <span
        className={unread ? 'n-notice__dot' : 'n-notice__dot n-notice__dot--read'}
        role={unread ? 'img' : undefined}
        aria-label={unread ? 'Unread' : undefined}
        aria-hidden={unread ? undefined : true}
      />
      <div className="n-notice__text">
        <p className="n-notice__title">{text}</p>
        {meta ? <p className="n-notice__meta">{meta}</p> : null}
      </div>
      <IconButton icon={X} label="Dismiss" onClick={onDismiss} />
      {actions ? <div className="n-notice__actions">{actions}</div> : null}
    </div>
  );
}

import { useEffect } from 'react';

import { Button } from '@/design-system/components/Button/Button';
import './Toast.css';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

interface ToastProps {
  message: string;
  action?: ToastAction;
  /** Milliseconds before it dismisses itself. */
  duration: number;
  onDismiss: () => void;
}

/**
 * A transient message, optionally with one action.
 *
 * Deferred in 2D because there was no consumer; delete-with-undo is the first
 * genuine one. §38 rules out toasting ordinary success — a saved note is the
 * expected outcome — but a destructive action with a time-limited reversal is
 * exactly what this is for.
 *
 * role="status" (a polite live region), not role="alert". The user just
 * performed this action, so interrupting whatever a screen reader was saying
 * to tell them about it would be rude. Polite means it is announced at the
 * next natural pause.
 *
 * FOCUS IS NOT STOLEN. Moving focus here would yank a keyboard user out of the
 * list they were navigating for a message they may not care about. The cost is
 * that reaching Undo requires tabbing to it, which is why the duration is
 * generous — and why undo is not the only way back: B4's trash listing means a
 * missed undo is recoverable, not data loss.
 */
export function Toast({ message, action, duration, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    // Without this, dismissing manually leaves a timer that fires later and
    // dismisses whatever toast has replaced this one.
    return () => {
      clearTimeout(timer);
    };
  }, [duration, onDismiss]);

  return (
    <div className="ds-toast" role="status">
      <p className="ds-toast__message">{message}</p>

      {action ? (
        <Button variant="ghost" size="sm" onClick={action.onAction}>
          {action.label}
        </Button>
      ) : null}

      <Button variant="ghost" size="sm" onClick={onDismiss} aria-label="Dismiss">
        <span aria-hidden="true">×</span>
      </Button>
    </div>
  );
}

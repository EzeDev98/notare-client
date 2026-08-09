import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { ToastContext, type ToastRequest } from '@/app/providers/toast-context';
import { Toast } from '@/design-system/components/Toast/Toast';

const DEFAULT_DURATION_MS = 8_000;

/**
 * ONE toast at a time; a new one replaces the current.
 *
 * A stack looks more capable and is worse here. Notare's toasts are
 * confirmations of deliberate actions, and if three are queued the user has
 * lost track of which Undo belongs to what. Replacing keeps the affordance
 * unambiguous — and if this app ever produces enough simultaneous events to
 * need a stack, that is a signal it is toasting things it should not (§38).
 *
 * 8 seconds, which is longer than the usual 4–5. Reaching Undo by keyboard
 * means tabbing to it, and the toast does not steal focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastRequest | null>(null);

  const show = useCallback((request: ToastRequest) => {
    setToast(request);
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  // Memoised so every consumer of the context does not re-render whenever an
  // unrelated part of the tree does.
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      {toast ? (
        <Toast
          // Remounts on a new message, so the auto-dismiss timer restarts
          // rather than inheriting the previous toast's remaining time.
          key={toast.message}
          message={toast.message}
          {...(toast.action ? { action: toast.action } : {})}
          duration={toast.duration ?? DEFAULT_DURATION_MS}
          onDismiss={dismiss}
        />
      ) : null}
    </ToastContext>
  );
}

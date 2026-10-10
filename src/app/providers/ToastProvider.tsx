import { use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { ToastContext, type ToastRequest } from '@/app/providers/toast-context';
import { Toast } from '@/design-system/components/Toast/Toast';
import {
  ToastContext as ToastContextNext,
  type ToastContextValue,
} from '@/design-system/ui/Toast/toast-context';
import { LEGACY_TOAST_MS } from '@/core/config/timings';

/**
 * The old toast API (`show({ message, action })`) that note hooks still call.
 *
 * Inside the new ToastProvider (step 6) it only forwards to it, so old and new
 * code show the same toast in the same place. The stand-alone one-toast version
 * below runs only where no new provider is mounted. Both go when the last old
 * `useToast` caller moves to `@/design-system/ui`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const next = use(ToastContextNext);
  return next ? (
    <ForwardingToastProvider next={next}>{children}</ForwardingToastProvider>
  ) : (
    <StandaloneToastProvider>{children}</StandaloneToastProvider>
  );
}

function ForwardingToastProvider({
  next,
  children,
}: {
  next: ToastContextValue;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      show: (request: ToastRequest) => {
        next.show({
          message: request.message,
          action: request.action,
          duration: request.duration,
        });
      },
      dismiss: () => {
        next.dismiss();
      },
    }),
    [next],
  );

  return <ToastContext value={value}>{children}</ToastContext>;
}

/**
 * ONE toast at a time; a new one replaces the current. 8 seconds.
 */
function StandaloneToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastRequest | null>(null);

  const show = useCallback((request: ToastRequest) => {
    setToast(request);
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      {toast ? (
        <Toast
          key={toast.message}
          message={toast.message}
          {...(toast.action ? { action: toast.action } : {})}
          duration={toast.duration ?? LEGACY_TOAST_MS}
          onDismiss={dismiss}
        />
      ) : null}
    </ToastContext>
  );
}

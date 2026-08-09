import { createContext, use } from 'react';

import type { ToastAction } from '@/design-system/components/Toast/Toast';

export interface ToastRequest {
  message: string;
  action?: ToastAction;
  /** Defaults to 8s — long enough to notice, read and reach Undo by keyboard. */
  duration?: number;
}

export interface ToastContextValue {
  show: (request: ToastRequest) => void;
  dismiss: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within <ToastProvider>.');
  }
  return context;
}

/** The toast context and its types. */
import { createContext, use } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastRequest {
  message: string;
  tone?: ToastTone | undefined;
  action?: ToastAction | undefined;
  duration?: number | undefined;
}

export interface ToastOptions {
  tone?: ToastTone | undefined;
  action?: ToastAction | undefined;
  long?: boolean | undefined;
}

export interface ToastEntry {
  id: number;
  message: string;
  tone: ToastTone;
  action: ToastAction | undefined;
  duration: number;
  closing: boolean;
}

export interface ToastContextValue {
  show: (request: ToastRequest) => number;
  toast: (message: string, options?: ToastOptions) => number;
  dismiss: (id?: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within <ToastProvider>.');
  }
  return context;
}

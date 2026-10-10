import { createContext, use } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastRequest {
  message: string;
  tone?: ToastTone | undefined;
  /** An action such as Undo. A toast with an action stays 6s instead of 4s. */
  action?: ToastAction | undefined;
  /** Milliseconds. Defaults to 4000, or 6000 for errors and toasts with an action. */
  duration?: number | undefined;
}

/** The short form: `toast('Note archived.', { action: { label: 'Undo', onAction } })`. */
export interface ToastOptions {
  tone?: ToastTone | undefined;
  action?: ToastAction | undefined;
  /** Stay 6s instead of 4s. */
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
  /** Shows a toast and returns its id. */
  show: (request: ToastRequest) => number;
  /** The short form of `show`. Returns the toast's id. */
  toast: (message: string, options?: ToastOptions) => number;
  /** Closes one toast, or every open toast when no id is given. */
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

/** Shows toast messages at the bottom of the screen. */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { TOAST_LONG_MS, TOAST_MAX, TOAST_MS } from '@/core/config/timings';

import { Toast } from './Toast';
import {
  ToastContext,
  type ToastEntry,
  type ToastOptions,
  type ToastRequest,
} from './toast-context';

import './Toast.css';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const show = useCallback((request: ToastRequest): number => {
    const id = nextId.current;
    nextId.current += 1;
    const tone = request.tone ?? 'neutral';
    const duration =
      request.duration ?? (tone === 'error' || request.action ? TOAST_LONG_MS : TOAST_MS);
    const entry: ToastEntry = {
      id,
      message: request.message,
      tone,
      action: request.action,
      duration,
      closing: false,
    };
    setEntries((list) => [...list, entry].slice(-TOAST_MAX));
    return id;
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}): number =>
      show({
        message,
        tone: options.tone,
        action: options.action,
        duration: options.long ? TOAST_LONG_MS : undefined,
      }),
    [show],
  );

  const dismiss = useCallback((id?: number) => {
    setEntries((list) =>
      list.map((entry) =>
        id === undefined || entry.id === id ? { ...entry, closing: true } : entry,
      ),
    );
  }, []);

  const remove = useCallback((id: number) => {
    setEntries((list) => list.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo(() => ({ show, toast, dismiss }), [show, toast, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      {createPortal(
        <div className="ui-toasts" aria-live="polite">
          {entries.map((entry) => (
            <Toast key={entry.id} entry={entry} onClose={dismiss} onGone={remove} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext>
  );
}

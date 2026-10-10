import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Toast } from './Toast';
import { ToastContext, type ToastEntry, type ToastRequest } from './toast-context';

import './Toast.css';

const MAX_TOASTS = 3;
const DEFAULT_MS = 4000;
const LONG_MS = 6000;

/**
 * Shows toasts in a portal at the bottom of the screen. At most 3 at a time:
 * a fourth pushes the oldest out. 4 seconds, or 6 for errors and toasts with an action.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const show = useCallback((request: ToastRequest): number => {
    const id = nextId.current;
    nextId.current += 1;
    const tone = request.tone ?? 'neutral';
    const duration = request.duration ?? (tone === 'error' || request.action ? LONG_MS : DEFAULT_MS);
    const entry: ToastEntry = { id, message: request.message, tone, action: request.action, duration, closing: false };
    setEntries((list) => [...list, entry].slice(-MAX_TOASTS));
    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setEntries((list) => list.map((entry) => (entry.id === id ? { ...entry, closing: true } : entry)));
  }, []);

  const remove = useCallback((id: number) => {
    setEntries((list) => list.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

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

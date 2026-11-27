/** One toast message. */
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fadeOut, toastIn } from '@/design-system/motion/patterns';
import { usePresence } from '@/design-system/motion/usePresence';

import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

import type { ToastEntry } from './toast-context';

interface ToastProps {
  entry: ToastEntry;
  onClose: (id: number) => void;
  onGone: (id: number) => void;
}

export function Toast({ entry, onClose, onGone }: ToastProps) {
  const [paused, setPaused] = useState(false);
  const { mounted, ref } = usePresence<HTMLDivElement>(!entry.closing, {
    enter: toastIn,
    exit: fadeOut,
  });

  useEffect(() => {
    if (entry.closing || paused) return undefined;
    const timer = window.setTimeout(() => {
      onClose(entry.id);
    }, entry.duration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [entry.closing, entry.duration, entry.id, onClose, paused]);

  useEffect(() => {
    if (entry.closing && !mounted) onGone(entry.id);
  }, [entry.closing, entry.id, mounted, onGone]);

  if (!mounted) return null;

  return (
    <div
      ref={ref}
      className="ui-toast"
      role={entry.tone === 'error' ? 'alert' : undefined}
      onPointerEnter={() => {
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={() => {
        setPaused(false);
      }}
    >
      {entry.tone === 'success' ? (
        <Icon icon={CircleCheck} className="ui-toast__icon ui-toast__icon--success" />
      ) : null}
      {entry.tone === 'error' ? (
        <Icon icon={CircleAlert} className="ui-toast__icon ui-toast__icon--error" />
      ) : null}
      <p className="ui-toast__message">{entry.message}</p>
      {entry.action ? (
        <Button
          variant="ghost"
          onClick={() => {
            entry.action?.onAction();
            onClose(entry.id);
          }}
        >
          {entry.action.label}
        </Button>
      ) : null}
      <IconButton
        icon={X}
        label="Dismiss"
        onClick={() => {
          onClose(entry.id);
        }}
      />
    </div>
  );
}

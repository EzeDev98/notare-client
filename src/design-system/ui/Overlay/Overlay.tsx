/** A modal, bottom sheet or drawer. */
import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { run } from '@/design-system/motion/motion';
import { drawerIn, fadeOut, modalIn, sheetIn } from '@/design-system/motion/patterns';
import { useOverlayBehavior } from '@/design-system/motion/useOverlayBehavior';
import { usePresence } from '@/design-system/motion/usePresence';

import { IconButton } from '../IconButton/IconButton';

import './Overlay.css';

type Variant = 'modal' | 'sheet' | 'drawer';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  variant?: Variant | undefined;
  title: string;
  dismissible?: boolean | undefined;
  footer?: ReactNode;
  children: ReactNode;
}

const PANEL_IN = { modal: modalIn, sheet: sheetIn, drawer: drawerIn } as const;
const FADE_IN = { duration: '--motion-base', easing: '--ease-standard' } as const;
const NOOP = (): void => undefined;

export function Overlay({
  open,
  onClose,
  variant = 'modal',
  title,
  dismissible = true,
  footer,
  children,
}: OverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, ref } = usePresence<HTMLDivElement>(open, {
    enter: (element) => {
      const panel = element.querySelector('.ui-overlay__panel');
      if (panel) PANEL_IN[variant](panel);
      return run(element, [{ opacity: 0 }, { opacity: 1 }], FADE_IN);
    },
    exit: fadeOut,
  });
  const { onScrimClick } = useOverlayBehavior(open, { ref: panelRef, onClose: dismissible ? onClose : NOOP });

  if (!mounted) return null;

  const labelled = variant === 'drawer' ? { 'aria-label': title } : { 'aria-labelledby': titleId };

  return createPortal(
    <div ref={ref} className={`ui-overlay ui-overlay--${variant}`}>
      <div className="ui-overlay__scrim" role="presentation" onClick={onScrimClick} />
      <div ref={panelRef} className="ui-overlay__panel" role="dialog" aria-modal="true" tabIndex={-1} {...labelled}>
        <div className="ui-overlay__head">
          {variant === 'drawer' ? null : (
            <h2 id={titleId} className="ui-overlay__title">
              {title}
            </h2>
          )}
          {dismissible ? (
            <span className="ui-overlay__close">
              <IconButton icon={X} label="Close" onClick={onClose} />
            </span>
          ) : null}
        </div>
        <div className="ui-overlay__body">{children}</div>
        {footer ? <div className="ui-overlay__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

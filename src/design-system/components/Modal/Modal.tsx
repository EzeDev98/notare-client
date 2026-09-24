import { useId, type ReactNode } from 'react';
import { Modal as PFModal, ModalBody, ModalFooter } from '@patternfly/react-core';

import { Button } from '@/design-system/components/Button/Button';
import './Modal.css';

interface ModalAction {
  label: string;
  onClick: () => void;
  /** Renders the action as a router link styled as a button. */
  href?: string;
}

interface ModalProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  primaryAction: ModalAction;
  secondaryAction?: ModalAction;
  onClose: () => void;
}

/**
 * A small confirmation dialog on PatternFly's Modal, which supplies the
 * backdrop, focus trap, Escape handling and close button — this file only
 * arranges content. Parents mount it to open it and unmount it to close it.
 *
 * Laid out as a compact, CENTRED alert — icon on top (large), then the
 * message, then the actions — rather than PatternFly's default left-aligned
 * header/body/footer bar. ModalHeader is deliberately not used at all: its
 * icon only ever rendered inside the title JSX, so a caller passing `icon`
 * with no `title` (several of this app's confirmations put the whole
 * question in `description` instead) silently lost its icon — and its
 * left-aligned single-line title doesn't fit this shape regardless. One
 * plain, fully-controlled content block replaces it, so every caller that
 * passes an icon gets one, centred and sized to match this layout.
 *
 * The primary action is autoFocused; PatternFly's focus trap keeps focus
 * that is already inside the dialog, so Enter confirms, like a native alert.
 */
export function Modal({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  onClose,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const hasTitle = title !== undefined && title !== '';
  const hasDescription = description !== undefined && description !== null;
  const hasIcon = icon !== undefined && icon !== null;

  return (
    <PFModal
      isOpen
      variant="small"
      onClose={onClose}
      className="ds-modal"
      backdropClassName="ds-modal-backdrop"
      aria-labelledby={hasTitle ? titleId : descriptionId}
      {...(hasTitle && hasDescription ? { 'aria-describedby': descriptionId } : {})}
    >
      <ModalBody>
        <div className="ds-modal__content">
          {hasIcon ? (
            <span className="ds-modal__icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}

          {hasTitle ? (
            <h2 id={titleId} className="ds-modal__title">
              {title}
            </h2>
          ) : null}

          {hasDescription ? (
            <p id={descriptionId} className="ds-modal__description">
              {description}
            </p>
          ) : null}
        </div>
      </ModalBody>

      <ModalFooter>
        {primaryAction.href ? (
          // Navigating unmounts the page (and this dialog) on its own.
          <Button
            to={primaryAction.href}
            variant="primary"
            size="sm"
            className="ds-modal__action"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        ) : (
          <Button
            autoFocus
            variant="primary"
            size="sm"
            className="ds-modal__action"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}

        {secondaryAction ? (
          <Button variant="secondary" size="sm" className="ds-modal__action" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </ModalFooter>
    </PFModal>
  );
}

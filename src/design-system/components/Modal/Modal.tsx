import { useId, type ReactNode } from 'react';
import { Modal as PFModal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';

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
      {hasTitle ? (
        <ModalHeader
          labelId={titleId}
          title={
            <>
              {icon ? (
                <span className="ds-modal__icon" aria-hidden="true">
                  {icon}
                </span>
              ) : null}
              {title}
            </>
          }
        />
      ) : null}

      {hasDescription ? <ModalBody id={descriptionId}>{description}</ModalBody> : null}

      <ModalFooter>
        {primaryAction.href ? (
          // Navigating unmounts the page (and this dialog) on its own.
          <Button to={primaryAction.href} variant="primary" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        ) : (
          <Button autoFocus variant="primary" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        )}

        {secondaryAction ? (
          <Button variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </ModalFooter>
    </PFModal>
  );
}

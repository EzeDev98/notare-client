import {
  Alert,
  AlertActionCloseButton,
  AlertActionLink,
  AlertGroup,
} from '@patternfly/react-core';
import { BellIcon } from '@patternfly/react-icons';

import './Toast.css';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

interface ToastProps {
  message: string;
  action?: ToastAction;
  duration: number;
  onDismiss: () => void;
}

/**
 * A PatternFly toast alert — the same AlertGroup + Alert pairing
 * internal-auth-client's toastContext uses. PatternFly owns the timeout,
 * the live region and the close button.
 */
export function Toast({ message, action, duration, onDismiss }: ToastProps) {
  return (
    <AlertGroup isToast isLiveRegion className="ds-toast">
      <Alert
        variant="custom"
        title={message}
        timeout={duration}
        onTimeout={onDismiss}
        customIcon={<BellIcon aria-hidden="true" />}
        actionClose={<AlertActionCloseButton onClose={onDismiss} />}
        {...(action
          ? {
              actionLinks: (
                <AlertActionLink onClick={action.onAction}>{action.label}</AlertActionLink>
              ),
            }
          : {})}
      />
    </AlertGroup>
  );
}

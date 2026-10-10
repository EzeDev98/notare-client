import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { StatusScreen } from '@/app/StatusScreen';
import { STATUS_COPY } from '@/app/statusContent';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

/**
 * "Page not found" (master 6.7.1). Any address that matches nothing ends here,
 * including a stale bookmark to a note that no longer exists.
 */
export function NotFoundScreen() {
  const navigate = useNavigate();
  useDocumentTitle(STATUS_COPY.notFoundTitle);

  return (
    <StatusScreen
      title={STATUS_COPY.notFoundTitle}
      text={STATUS_COPY.notFoundText}
      actionLabel={STATUS_COPY.notFoundAction}
      onAction={() => {
        void navigate(ROUTES.notes());
      }}
    />
  );
}

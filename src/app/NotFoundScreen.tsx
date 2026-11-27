/** "Page not found" screen. */
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { StatusScreen } from '@/app/StatusScreen';
import { STATUS_COPY } from '@/app/statusContent';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

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

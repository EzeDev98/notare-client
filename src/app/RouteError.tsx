/** Shown in place of a route that failed. */
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { NotFoundScreen } from '@/app/NotFoundScreen';
import { StatusScreen } from '@/app/StatusScreen';
import { STATUS_COPY } from '@/app/statusContent';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundScreen />;
  }

  return <CrashScreen error={error} />;
}

export function CrashScreen({ error }: { error: unknown }) {
  useDocumentTitle(STATUS_COPY.errorTitle);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      title={STATUS_COPY.errorTitle}
      text={STATUS_COPY.errorText}
      actionLabel={STATUS_COPY.errorAction}
      onAction={() => {
        window.location.reload();
      }}
    />
  );
}

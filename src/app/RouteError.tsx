import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { NotFoundScreen } from '@/app/NotFoundScreen';
import { StatusScreen } from '@/app/StatusScreen';
import { STATUS_COPY } from '@/app/statusContent';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

/**
 * Rendered in place of a route that threw (master 6.7.1).
 *
 * A path that matches nothing is "Page not found". Anything else is
 * "Something went wrong" with a Reload button. The person never sees the
 * error's message or stack: it goes to the console for us and the screen says
 * only that their notes are safe, because they are (every write is local first).
 *
 * Attached to the LAYOUT routes rather than the router root, so a render error
 * in one screen is caught by its own layout.
 */
export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundScreen />;
  }

  return <CrashScreen error={error} />;
}

function CrashScreen({ error }: { error: unknown }) {
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

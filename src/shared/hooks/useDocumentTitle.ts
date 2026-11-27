/** Sets the page title for a screen. */
import { useEffect } from 'react';

const SUFFIX = 'Notare';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${SUFFIX}`;
  }, [title]);
}

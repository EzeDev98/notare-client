import { useEffect } from 'react';

const SUFFIX = 'Notare';

/**
 * Sets the document title for a screen.
 *
 * More than cosmetic: the title is what a screen reader announces on page
 * change, what a browser tab shows when a user has fifteen open, and what gets
 * saved as the bookmark name. A whole app titled "Notare" gives all three of
 * those users nothing to distinguish one screen from another.
 *
 * Genuinely an effect — document.title is state outside React's tree, and
 * synchronising with an external system is what effects are for (§9). Not
 * every useEffect is a smell; this one is textbook.
 *
 * No cleanup restoring the previous title. The next screen sets its own, and
 * restoring on unmount would flash the old title during a transition.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${SUFFIX}`;
  }, [title]);
}

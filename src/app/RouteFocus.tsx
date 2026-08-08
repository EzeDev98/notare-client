import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Restores what a browser does for free on a full page load, and a client-side
 * route change does not: reset focus and scroll to the top of the new page.
 *
 * WITHOUT THIS, a screen reader user navigating the app hears NOTHING. React
 * swaps the DOM, the URL changes, and focus stays on the link they clicked —
 * an element that no longer exists. From their side, pressing Enter did
 * nothing. This is the most common accessibility failure in React apps and it
 * is completely invisible to anyone testing with a mouse.
 *
 * Focus, not an aria-live announcement. Both are established patterns and
 * doing BOTH makes the page name announce twice. Focus is the better single
 * choice because it also answers "where am I now" — after an
 * announcement-only fix, the next Tab still continues from the dead link.
 *
 * Rendered inside the layout, next to <main>, so it can find its target.
 */
export function RouteFocus({ targetId }: { targetId: string }) {
  const { pathname } = useLocation();

  /*
   * A ref, not state: changing it must NOT re-render, and it must survive
   * across renders. This is the ref-as-instance-variable use, distinct from
   * ref-as-DOM-handle — the same hook, two quite different jobs.
   */
  const isFirstRender = useRef(true);

  useEffect(() => {
    /*
     * Skip the initial load. The browser has already put focus in the right
     * place, and stealing it would move the user away from wherever they
     * actually are — including away from a #hash target they deep-linked to.
     */
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const target = document.getElementById(targetId);
    if (!target) return;

    /*
     * tabIndex=-1 makes it focusable programmatically without adding a tab
     * stop. Without it, focus() silently does nothing — no error, no effect,
     * and the bug looks like the effect never ran.
     *
     * No outline suppression here, deliberately: programmatic focus() does not
     * trigger :focus-visible, so no ring is painted, while a genuine Tab into
     * main still shows one. Adding `outline: none` would break the second case
     * to fix a problem that does not exist.
     */
    target.focus();

    // A browser scrolls to the top on navigation too. Instant rather than
    // smooth — a smooth scroll after a focus jump is disorienting, and 2A's
    // reduced-motion block already forces it to auto for anyone who asked.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, targetId]);

  return null;
}

import type { ReactNode } from 'react';
import './VisuallyHidden.css';

/**
 * Content available to screen readers and hidden from sight.
 *
 * NOT display:none or visibility:hidden — both remove the element from the
 * accessibility tree entirely, which is the opposite of the point. The CSS
 * clips it to a 1px box instead, leaving it rendered and announced.
 *
 * For text that carries meaning an icon conveys visually: a spinner's "Loading",
 * an icon button's label, a heading that structures the page for a screen
 * reader without appearing on it.
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="ds-visually-hidden">{children}</span>;
}

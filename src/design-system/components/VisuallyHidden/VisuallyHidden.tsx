import type { ReactNode } from 'react';

/**
 * Content available to screen readers and hidden from sight.
 *
 * `pf-v6-screen-reader` is PatternFly's own visually-hidden utility, already
 * loaded globally by base.css and already used internally by PatternFly's
 * own components (HelperTextItem's screen-reader-only status text, for
 * one) — so this reaches for that class instead of carrying a second,
 * hand-written implementation of the identical clip-to-nothing technique.
 *
 * For text that carries meaning an icon conveys visually: a spinner's "Loading",
 * an icon button's label, a heading that structures the page for a screen
 * reader without appearing on it.
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="pf-v6-screen-reader">{children}</span>;
}

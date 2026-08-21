import { useEffect, useRef, useState, type AnimationEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import { Button } from '@/design-system/components/Button/Button';
import './Modal.css';

interface ModalAction {
  label: string;
  onClick: () => void;
  href?: string;
}

interface ModalProps {
  /**
   * A single Lucide icon element, e.g. `<Check aria-hidden="true" />`.
   * Rendered inside a tinted rounded-square badge above the title. Omit
   * entirely for a text-only alert — the badge only renders when this is
   * passed.
   */
  icon?: ReactNode;
  title?: string;
  /**
   * Optional body copy under the title. Accepts a node (not just a string)
   * so a caller can bold a name inline, same as InviteCollaboratorPage's
   * existing modal text does with `<strong>`.
   */
  description?: ReactNode;
  /** Right-hand, filled button — the emphasized action. */
  primaryAction: ModalAction;
  /** Left-hand, outlined button. Omit for a single-button alert. */
  secondaryAction?: ModalAction;
  onClose: () => void;
}

/**
 * A centered, native-alert-style confirmation dialog: icon badge, centered
 * title/description, two equal-width buttons side by side. Modeled directly
 * on the platform's own alert pattern (see the design handoff) rather than
 * the previous one-off modal in InviteCollaboratorPage, which right-aligned
 * auto-width buttons and hardcoded its own colors instead of pulling from
 * `tokens/colors.css`. This is the version every future confirmation/alert
 * in the app should reuse instead of hand-rolling another.
 *
 * Rendered via a portal to `document.body`, not inline where it's called —
 * so its `position: fixed` backdrop is never clipped by an ancestor with
 * `overflow: hidden` or `transform` (either one creates a new containing
 * block for `fixed` descendants), regardless of where in the tree a future
 * caller mounts it.
 */
export function Modal({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  onClose,
}: ModalProps) {
  /*
   * Step 6B. The caller's `onClose`/action `onClick` props all ultimately
   * flip some piece of THEIR state to stop rendering this component — this
   * component has no control over when React actually tears its node down.
   * Calling one of those directly unmounts instantly, mid-animation.
   *
   * The fix: never call the real callback directly. Instead flip local
   * `isClosing` state (which drives the `data-closing` CSS below onto an
   * exit keyframe instead of the enter one already playing), stash which
   * callback should ultimately run, and only invoke it once the backdrop's
   * own exit `animationend` fires — see handleBackdropAnimationEnd. That
   * exit animation is exactly what's still visible up to the moment this
   * component actually unmounts, since nothing here delays the parent's
   * state update itself, only how long this component waits to trigger it.
   */
  const [isClosing, setIsClosing] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  function requestClose(action: () => void) {
    // A second Escape press, or a stray click, while the exit animation is
    // already running: the close is already queued, so don't restart it or
    // clobber which callback is pending.
    if (isClosing) return;
    pendingActionRef.current = action;
    setIsClosing(true);
  }

  function runPendingAction() {
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  }

  function handleBackdropAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    // The dialog's own exit animation also bubbles an animationend up
    // through this element; only react to the backdrop's OWN animation
    // finishing, not the child's.
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== 'ds-modal-backdrop-exit') return;

    runPendingAction();
  }

  /*
   * Safety net for handleBackdropAnimationEnd. `animationend` depends on a
   * real CSS animation actually running to completion — jsdom (every test
   * in this app runs under it) never runs CSS animations at all, so
   * without this, EVERY test that confirms a Modal action would hang: the
   * dialog stays stuck at `data-closing="true"` forever and the real
   * onClick (delete-forever, revoke, etc.) never fires. It's also a
   * reasonable guard in a real browser, for the same reason 2A's
   * reduced-motion block uses 0.01ms rather than a true 0 — anything that
   * can stop an animation from completing (a dropped frame, the tab losing
   * focus, a future CSS regression) would otherwise strand this dialog
   * with no way out. 250ms comfortably clears the real exit animation's
   * --motion-duration-fast (120ms), so the animationend branch above is
   * still what normally wins this race in a browser; this only matters
   * when that event never arrives at all.
   */
  useEffect(() => {
    if (!isClosing) return;

    const timeout = setTimeout(runPendingAction, 250);
    return () => {
      clearTimeout(timeout);
    };
  }, [isClosing]);

  useEffect(() => {
    // Matches every native alert: the keyboard-accessible way out, in
    // addition to the backdrop click below. Without this, a keyboard user
    // with no pointer has no way to dismiss the dialog at all.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestClose(onClose);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
    // isClosing is a real dependency, not an oversight: requestClose reads
    // it via closure to guard against a second Escape press re-triggering
    // the close mid-animation. Without resubscribing here, this listener
    // would keep the STALE isClosing captured at mount and let a second
    // press slip past the guard and clobber pendingActionRef.
  }, [onClose, isClosing]);

  return createPortal(
    <div
      className="ds-modal-backdrop"
      role="presentation"
      data-closing={isClosing ? 'true' : undefined}
      onAnimationEnd={handleBackdropAnimationEnd}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose(onClose);
        }
      }}
    >
      <div
        className="ds-modal"
        role="dialog"
        aria-modal="true"
        data-closing={isClosing ? 'true' : undefined}
        aria-labelledby={
          title ? 'ds-modal-title' : description ? 'ds-modal-description' : undefined
        }
        aria-describedby={title && description ? 'ds-modal-description' : undefined}
      >
        {icon ? (
          <div className="ds-modal__icon" aria-hidden="true">
            {icon}
          </div>
        ) : null}

        <h2 id="ds-modal-title" className="ds-modal__title">
          {title}
        </h2>

        {description ? (
          <p id="ds-modal-description" className="ds-modal__description">
            {description}
          </p>
        ) : null}

        <div className="ds-modal__actions">
          {secondaryAction ? (
            <Button
              variant="secondary"
              className="ds-modal__action"
              onClick={() => {
                requestClose(secondaryAction.onClick);
              }}
            >
              {secondaryAction.label}
            </Button>
          ) : null}

          {/*
            autoFocus, not a ref: `Button` types its props as
            ComponentPropsWithoutRef<'button'> and never declares or
            attaches its own `ref` parameter, so passing one here would
            silently do nothing. `autoFocus` is an ordinary native button
            prop instead — it flows through Button's `...rest` spread onto
            the real <button> and the browser handles the focus itself.
            Same effect as a native alert defaulting to its emphasized
            button, without fighting Button's ref-less design.

            NOT a full focus trap — Tab can still leave the dialog and
            reach the page behind it. Worth building if this component
            grows past two buttons or gains form fields; for a two-button
            confirmation the risk is low and it isn't implemented here,
            flagged rather than silently shipped as if it were complete.
          */}
          {primaryAction.href ? (
            /*
             * data-variant/data-size, not a `ds-button--primary` class —
             * matching exactly how Button.tsx itself renders these two
             * attributes onto the real <button> below. Button.css only
             * ever selects on `.ds-button[data-variant=...]` and
             * `.ds-button[data-size=...]`; a modifier class like
             * `ds-button--primary` matches nothing in that file, which is
             * why this Link previously rendered with none of Button's
             * variant styling — no fill, no sizing, just the bare
             * `.ds-button` base rules (border, radius, transitions).
             *
             * NOT routed through requestClose: clicking this Link
             * navigates immediately, which unmounts this whole page
             * (Modal included) before any exit animation could run —
             * same as any other outgoing page content today. Delaying
             * onClick here would only risk it firing after this
             * component's own instance is already gone.
             */
            <Link
              to={primaryAction.href}
              className="ds-button ds-modal__action"
              data-variant="primary"
              data-size="md"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Link>
          ) : (
            <Button
              autoFocus
              variant="primary"
              className="ds-modal__action"
              onClick={() => {
                requestClose(primaryAction.onClick);
              }}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

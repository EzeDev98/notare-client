#!/usr/bin/env python3
"""
Run from the repo root: python3 apply-modal-shape-update.py

Reworks the shared Modal component's SHAPE to match the reference dialog
exactly (same layout/proportions as the yellow screenshot, just in the
app's own lavender), while keeping every earlier color change intact:

1) Removes the top-right (X) close button — the reference dialog has no
   close affordance beyond Cancel / Escape / backdrop-click, which the
   Modal already supports.
2) Shrinks the modal to a consistent compact 360px card (previously 400px,
   with a one-off 360px override only on the delete-note modal). Every
   modal now renders at this one size.
3) Makes both action buttons fully pill-shaped and taller (40px, more
   rounded), matching the reference dialog's buttons instead of the
   app's standard rectangular Button corners.
4) Removes the delete-note modal's one-off "large unbadged icon" styling
   so it uses the same lavender icon badge every other modal uses.

Depends on apply-modal-updates.py having already been run (it assumes
the `destructive` prop is already gone from Modal.tsx). Safe to run
standalone otherwise — it just skips anything it can't find.
"""

def replace_once(path, old, new, label):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count != 1:
        print(f"  SKIP ({count} matches, expected 1): {label} in {path}")
        return False
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK: {label} in {path}")
    return True


print("Step 1/3: Modal.tsx — remove the close (X) button")
modal_tsx = "src/design-system/components/Modal/Modal.tsx"

replace_once(
    modal_tsx,
    """import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { X } from 'lucide-react';

import { Button } from '@/design-system/components/Button/Button';""",
    """import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import { Button } from '@/design-system/components/Button/Button';""",
    "drop unused X import",
)

replace_once(
    modal_tsx,
    """        ) : null}

        <button
          type="button"
          className="ds-modal__close"
          aria-label="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </button>

        <h2 id="ds-modal-title" className="ds-modal__title">""",
    """        ) : null}

        <h2 id="ds-modal-title" className="ds-modal__title">""",
    "remove close button markup",
)

print()
print("Step 2/3: Modal.css — compact 360px width, pill buttons, unified badge icon")
modal_css_path = "src/design-system/components/Modal/Modal.css"
modal_css_content = '''@layer components {
  .ds-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);

    /*
     * No token for this: it's the one place in the app that deliberately
     * darkens the page it sits over rather than sitting on --color-surface
     * like everything else, so there's nothing in tokens/colors.css to
     * point at. rgb(...) over a hex/keyword so opacity can vary
     * independently of the color itself.
     */
    background-color: rgb(0 0 0 / 45%);
    backdrop-filter: blur(4px);
  }

  /*
   * Sized and proportioned to match the reference dialog exactly (see the
   * design handoff): a compact 360px card, not the wider 400px this used
   * to default to. Every modal in the app renders through this one rule
   * now — there is no longer a per-caller size override, so keeping this
   * number right here is what keeps every confirmation dialog the same
   * size instead of drifting apart one override at a time.
   */
  .ds-modal {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    inline-size: min(360px, calc(100vw - 32px));
    padding: var(--space-8) var(--space-6) var(--space-6);
    border-radius: var(--radius-lg);
    background-color: var(--color-surface);
    box-shadow: var(--shadow-md);
    text-align: center;
  }

  .ds-modal__icon {
    display: grid;
    place-items: center;
    inline-size: 56px;
    block-size: 56px;
    margin-block-end: var(--space-2);
    border-radius: var(--radius-lg);

    /*
     * The one deliberate accent exception in this component: a badge
     * exists to draw the eye, so it uses the lavender pairing the rest of
     * the app reserves for identity/selected-state, same reasoning as
     * `.shared-note__voice-icon` in SharedNote.css. Every modal uses this
     * same badge now, including the delete-note confirmation, which used
     * to render its icon large and unbadged as a one-off exception — the
     * reference dialog's icon sits inside a filled square exactly like
     * this one, so that exception no longer has a reason to exist.
     */
    background-color: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  /*
   * Size override + `color: inherit`, same pattern used everywhere else
   * an icon sits in an accent-colored badge: `.lucide` sets both directly
   * on the svg in the base layer, which blocks inheriting either the
   * bigger badge size or the badge's accent color from `.ds-modal__icon`
   * above. Without this the icon would render at the standard 20px in
   * flat muted gray instead of standing out the way the badge intends.
   */
  .ds-modal__icon svg {
    inline-size: 28px;
    block-size: 28px;
    color: inherit;
  }

  .ds-modal__title {
    margin: 0;
    color: var(--color-text);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
  }

  .ds-modal__description {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
  }

  .ds-modal__description strong {
    color: var(--color-text);
    font-weight: var(--font-weight-medium);
  }

  .ds-modal__actions {
    display: flex;
    inline-size: 100%;
    gap: 10px;
    margin-block-start: var(--space-4);
  }

  /*
   * Equal-width, side by side — the reference dialog's layout, and a
   * deliberate departure from InviteCollaboratorPage's old modal, which
   * right-aligned two auto-width buttons instead. flex: 1 on both buttons
   * (rather than sizing to each label) is what keeps Cancel/Delete-style
   * pairs visually balanced regardless of which one has the longer word.
   *
   * min-block-size/padding-inline and the fully-pill border-radius below
   * are what the reference dialog's buttons actually look like — taller
   * and more rounded than `Button`'s own `md` size and `--radius-md`
   * default. Specificity here (two classes) is deliberately higher than
   * `.ds-button`'s single-class `border-radius: var(--radius-md)` in
   * Button.css, so this wins regardless of which stylesheet the browser
   * happens to inject first — see that file's own note on `@layer`
   * ordering being injection-order-dependent in dev.
   */
  .ds-modal__actions .ds-modal__action {
    flex: 1;
    min-block-size: 40px;
    padding-inline: var(--space-4);
    border-radius: 999px;
  }
}
'''
with open(modal_css_path, "w", encoding="utf-8") as f:
    f.write(modal_css_content)
print(f"  OK: rewrote {modal_css_path}")

print()
print("Step 3/3: AppLayout.tsx — drop the now-dead delete-note-modal__icon class")
replace_once(
    "src/app/layouts/AppLayout.tsx",
    '''icon={<NotebookPen className="delete-note-modal__icon" aria-hidden="true" />}''',
    '''icon={<NotebookPen aria-hidden="true" />}''',
    "use the standard badge icon like every other modal",
)

print()
print("Done. Review with `git diff`, then run your typecheck/lint before committing.")

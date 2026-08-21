#!/usr/bin/env python3
"""
Run from the repo root: python3 apply-modal-button-radius.py

Swaps the modal action buttons' pill shape (999px, taller, extra padding)
for the reference dialog's actual look: Button's own standard size, with
--radius-lg (10px) corners and the existing purple `primary` fill —
matching the reference exactly instead of overshooting into a full pill.

Depends on apply-modal-updates.py and apply-modal-shape-update.py having
already been run.
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


print("Modal.css — standard button size, 10px corners instead of a pill")
path = "src/design-system/components/Modal/Modal.css"

replace_once(
    path,
    """   * min-block-size/padding-inline and the fully-pill border-radius below
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
  }""",
    """   * Otherwise this is Button's own standard `md` sizing — no height or
   * padding override. `border-radius: var(--radius-lg)` is the one
   * deliberate departure from Button's own `--radius-md` corners,
   * matching the modal card's own radius rather than introducing a third
   * radius value. Specificity here (two classes) is deliberately higher
   * than `.ds-button`'s single-class `border-radius: var(--radius-md)`
   * in Button.css, so this wins regardless of which stylesheet the
   * browser happens to inject first — see that file's own note on
   * `@layer` ordering being injection-order-dependent in dev.
   */
  .ds-modal__actions .ds-modal__action {
    flex: 1;
    border-radius: var(--radius-lg);
  }""",
    "standard size + 10px radius instead of pill",
)

print()
print("Done. Review with `git diff`, then run your typecheck/lint before committing.")

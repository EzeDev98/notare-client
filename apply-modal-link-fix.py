#!/usr/bin/env python3
"""
Run from the repo root: python3 apply-modal-link-fix.py

Fixes the actual bug behind the purple-button issue: Modal's primary
action, when given an `href` (used by InviteCollaboratorPage's
"already invited" / "invitation already sent" dialogs), renders as a
<Link>, not a <Button>. That Link was styled with a class name,
`ds-button--primary`, that does not exist anywhere in Button.css —
Button.css only ever selects on `data-variant`/`data-size` ATTRIBUTES,
which is how the real <button> in Button.tsx signals its variant. So the
Link was rendering with none of the variant styling: no purple fill, no
sizing — just the bare base .ds-button rules.

This makes the Link use the same data-variant="primary" / data-size="md"
attributes Button.tsx itself sets, so it now picks up the same purple
fill, sizing, and (from the earlier patches) the same 10px radius as
every other primary button in the app.

Depends on apply-modal-updates.py, apply-modal-shape-update.py, and
apply-modal-button-radius.py having already been run.
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


print("Modal.tsx — fix the primary-action Link's fake variant class")
path = "src/design-system/components/Modal/Modal.tsx"

replace_once(
    path,
    """          {primaryAction.href ? (
            <Link
              to={primaryAction.href}
              className="ds-button ds-button--primary ds-modal__action"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Link>
          ) : (""",
    """          {primaryAction.href ? (
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
          ) : (""",
    "use real data-variant/data-size attributes instead of a fake class",
)

print()
print("Done. Review with `git diff`, then run your typecheck/lint before committing.")

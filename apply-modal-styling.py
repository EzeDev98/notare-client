#!/usr/bin/env python3
"""
Run from the repo root: python3 apply-modal-styling.py

Updates the shared Modal styling:

- 360px compact modal.
- 50px object icon.
- Light 1.25px Lucide stroke inherited from the app.
- Existing icon color.
- No special trash/delete-note icon styling.
- Balanced action buttons.
"""

from pathlib import Path

path = Path("src/design-system/components/Modal/Modal.css")
content = path.read_text(encoding="utf-8")

replacements = [
    (
        "inline-size: min(100%, 400px);",
        "inline-size: min(360px, calc(100vw - 32px));",
        "modal width",
    ),
    (
        """    inline-size: 56px;
    block-size: 56px;
""",
        """    inline-size: 72px;
    block-size: 72px;
""",
        "icon container size",
    ),
    (
        """    background-color: var(--color-accent-subtle);
    color: var(--color-accent);
""",
        """    background-color: transparent;
    color: var(--color-icon);
""",
        "use existing icon color without a heavy badge",
    ),
    (
        """    inline-size: 28px;
    block-size: 28px;
""",
        """    inline-size: 50px;
    block-size: 50px;
""",
        "icon size",
    ),
    (
        """    gap: var(--space-3);
""",
        """    gap: 10px;
""",
        "button gap",
    ),
    (
        """.ds-modal__action {
    flex: 1;
  }
""",
        """.ds-modal__actions .ds-modal__action {
    flex: 1;
    border-radius: var(--radius-lg);
  }
""",
        "balanced rounded action buttons",
    ),
]

for old, new, label in replacements:
    count = content.count(old)
    if count != 1:
        print(f"SKIP ({count} matches): {label}")
    else:
        content = content.replace(old, new)
        print(f"OK: {label}")

# Remove the old delete-note-specific styling block if it still exists.
marker = "\n\n/* Delete-note confirmation:"
if marker in content:
    start = content.index(marker)
    content = content[:start].rstrip() + "\n"
    print("OK: removed old delete-note-specific modal styling")

path.write_text(content, encoding="utf-8")
print("\nDone: Modal.css")

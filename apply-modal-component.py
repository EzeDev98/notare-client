#!/usr/bin/env python3
"""
Run from the repo root: python3 apply-modal-component.py

Updates the shared Modal component for destructive/irreversible confirmations:

- No required modal title.
- Removes the generic top-right X close button.
- Removes the destructive/danger variant from the modal API.
- Allows the description to be the modal's only visible copy.
- Keeps accessibility wiring correct when there is no title.
- Keeps href primary actions visually identical to Button primary actions.
"""

from pathlib import Path

path = Path("src/design-system/components/Modal/Modal.tsx")
content = path.read_text(encoding="utf-8")

replacements = [
    (
        "import { X } from 'lucide-react';\n",
        "",
        "remove generic X import",
    ),
    (
        """  title: string;
""",
        """  title?: string;
""",
        "make title optional",
    ),
    (
        """  /**
   * Gives the primary action the danger treatment instead of the
   * default lavender/purple treatment.
   */
  destructive?: boolean;
""",
        "",
        "remove destructive prop",
    ),
    (
        """  destructive = false,
""",
        "",
        "remove destructive destructuring",
    ),
    (
        """        aria-labelledby="ds-modal-title"
        aria-describedby={description ? 'ds-modal-description' : undefined}
""",
        """        aria-labelledby={
          title ? 'ds-modal-title' : description ? 'ds-modal-description' : undefined
        }
        aria-describedby={title && description ? 'ds-modal-description' : undefined}
""",
        "fix accessible name when title is absent",
    ),
    (
        """        <button
          type="button"
          className="ds-modal__close"
          aria-label="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </button>

        <h2 id="ds-modal-title" className="ds-modal__title">
          {title}
        </h2>
""",
        """        {title ? (
          <h2 id="ds-modal-title" className="ds-modal__title">
            {title}
          </h2>
        ) : null}
""",
        "remove close button and conditionally render title",
    ),
    (
        """              className="ds-button ds-button--primary ds-modal__action"
              onClick={primaryAction.onClick}
""",
        """              className="ds-button ds-modal__action"
              data-variant="primary"
              data-size="md"
              onClick={primaryAction.onClick}
""",
        "make Link primary action use real Button variant attributes",
    ),
    (
        """              variant={destructive ? 'danger' : 'primary'}
""",
        """              variant="primary"
""",
        "always use primary modal action",
    ),
]

for old, new, label in replacements:
    count = content.count(old)
    if count != 1:
        print(f"SKIP ({count} matches): {label}")
    else:
        content = content.replace(old, new)
        print(f"OK: {label}")

path.write_text(content, encoding="utf-8")
print("\nDone: Modal.tsx")

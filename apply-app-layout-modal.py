#!/usr/bin/env python3

from pathlib import Path

path = Path("src/app/layouts/AppLayout.tsx")
content = path.read_text(encoding="utf-8")

old = """          title=""
          description={
            <>
              Are you sure you want to delete
              <br />
              the selected note?
            </>
          }
          icon={<NotebookPen className="delete-note-modal__icon" aria-hidden="true" />}
          destructive
"""

new = """          description="Are you sure you want to delete the selected note?"
          icon={<NotebookPen aria-hidden="true" />}
"""

if content.count(old) != 1:
    raise SystemExit("Expected AppLayout modal block exactly once")

content = content.replace(old, new)
path.write_text(content, encoding="utf-8")

print("Done: AppLayout.tsx")

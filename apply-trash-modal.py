#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/Trash/Trash.tsx")
content = path.read_text(encoding="utf-8")

content = content.replace(
    "import { Trash2 } from 'lucide-react';",
    "import { NotebookPen } from 'lucide-react';",
)

old = """          icon={<Trash2 aria-hidden="true" />}
          title="Delete note forever?"
          description={
            <>
              <strong>
                {confirmingNote.title.trim() || 'Untitled'}
              </strong>{' '}
              will be permanently deleted. This action cannot be undone.
            </>
          }
"""

new = """          icon={<NotebookPen aria-hidden="true" />}
          description={
            <>
              Delete <strong>{confirmingNote.title.trim() || 'Untitled'}</strong>{' '}
              forever? This action cannot be undone.
            </>
          }
"""

if content.count(old) != 1:
    raise SystemExit("Expected Trash delete-forever modal exactly once")

content = content.replace(old, new)
content = content.replace("          destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: Trash.tsx")

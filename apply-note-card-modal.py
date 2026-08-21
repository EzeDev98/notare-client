#!/usr/bin/env python3

from pathlib import Path

path = Path("src/features/notes/components/NoteCard/NoteCard.tsx")
content = path.read_text(encoding="utf-8")

content = content.replace(
    "import { Trash2 } from 'lucide-react';",
    "import { NotebookPen } from 'lucide-react';",
)

old = """          icon={<Trash2 aria-hidden="true" />}
          title="Delete this note?"
          description="The note will be moved to Trash."
"""

new = """          icon={<NotebookPen aria-hidden="true" />}
          description="Delete this note? The note will be moved to Trash."
"""

if content.count(old) != 1:
    raise SystemExit("Expected NoteCard delete modal exactly once")

content = content.replace(old, new)
content = content.replace("          destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: NoteCard.tsx")

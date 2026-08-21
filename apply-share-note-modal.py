#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/ShareNote/ShareNote.tsx")
content = path.read_text(encoding="utf-8")

old = """          title="Remove this collaborator?"
          description={
            <>
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong> will lose access to
              this note.
            </>
          }
"""

new = """          description={
            <>
              Remove this collaborator?{' '}
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong>{' '}
              will lose access to this note.
            </>
          }
"""

if content.count(old) != 1:
    raise SystemExit("Expected ShareNote collaborator modal exactly once")

content = content.replace(old, new, 1)
content = content.replace("          destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: ShareNote.tsx")

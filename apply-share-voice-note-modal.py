#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/ShareVoiceNote/ShareVoiceNote.tsx")
content = path.read_text(encoding="utf-8")

old = """          title="Remove this collaborator?"
          description={
            <>
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong> will lose access to
              this voice note.
            </>
          }
"""

new = """          description={
            <>
              Remove this collaborator?{' '}
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong>{' '}
              will lose access to this voice note.
            </>
          }
"""

if content.count(old) != 1:
    raise SystemExit("Expected ShareVoiceNote collaborator modal exactly once")

content = content.replace(old, new, 1)
content = content.replace("          destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: ShareVoiceNote.tsx")

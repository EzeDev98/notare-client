#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/VoiceDetail/VoiceDetail.tsx")
content = path.read_text(encoding="utf-8")

content = content.replace(
    "import { Share, Trash2 } from 'lucide-react';",
    "import { Mic, Share, Trash2 } from 'lucide-react';",
)

old = """              icon={<Trash2 aria-hidden="true" />}
              title="Delete this voice note?"
              description="This voice note will be permanently deleted. This action cannot be undone."
"""

new = """              icon={<Mic aria-hidden="true" />}
              description="Delete this voice note? This voice note will be permanently deleted. This action cannot be undone."
"""

if content.count(old) != 1:
    raise SystemExit("Expected VoiceDetail delete modal exactly once")

content = content.replace(old, new)
content = content.replace("              destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: VoiceDetail.tsx")

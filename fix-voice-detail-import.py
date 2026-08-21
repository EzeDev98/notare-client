#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/VoiceDetail/VoiceDetail.tsx")
content = path.read_text(encoding="utf-8")

old = "import { Mic, Share, Trash2 } from 'lucide-react';"
new = "import { Mic, Share } from 'lucide-react';"

if content.count(old) != 1:
    print(f"ERROR: expected exactly 1 matching import, found {content.count(old)}")
    raise SystemExit(1)

content = content.replace(old, new, 1)
path.write_text(content, encoding="utf-8")

print("OK: Removed unused Trash2 import from VoiceDetail.tsx")

#!/usr/bin/env python3
"""
Run from the repo root:

    python3 fix-all-modal-icon-size.py

Forces every icon rendered inside the shared Modal component to exactly
50px x 50px.

The !important declarations are intentional because other application-wide
SVG/icon rules or Lucide's own width/height attributes may otherwise
override the modal's intended size.
"""

from pathlib import Path
import re

path = Path("src/design-system/components/Modal/Modal.css")

if not path.exists():
    raise SystemExit(f"ERROR: File not found: {path}")

content = path.read_text(encoding="utf-8")

pattern = re.compile(
    r"(\.ds-modal__icon\s+svg\s*\{)(.*?)(\n\s*\})",
    re.DOTALL,
)

match = pattern.search(content)

if not match:
    print("ERROR: Could not find .ds-modal__icon svg CSS rule.")
    print("No changes were made.")
    raise SystemExit(1)

replacement = """\\1
    inline-size: 50px !important;
    block-size: 50px !important;
    width: 50px !important;
    height: 50px !important;
    color: inherit;\\3"""

content = content[:match.start()] + replacement + content[match.end():]

path.write_text(content, encoding="utf-8")

print("OK: Modal.css updated")
print()
print("Every modal SVG icon is now forced to:")
print("  inline-size: 50px !important")
print("  block-size: 50px !important")
print("  width: 50px !important")
print("  height: 50px !important")
print()
print("The existing icon color and light Lucide stroke are preserved.")

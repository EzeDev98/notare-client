#!/usr/bin/env python3

from pathlib import Path
import re

ROOT = Path("src")

found = []

for path in ROOT.rglob("*.tsx"):
    content = path.read_text(encoding="utf-8")

    # Find a Modal block containing the collaboration confirmation text.
    modal_pattern = re.compile(
        r"<Modal\b(?:(?!</?Modal\b).)*?Invitation already sent(?:(?!</?Modal\b).)*?\/>",
        re.DOTALL,
    )

    for match in modal_pattern.finditer(content):
        found.append((path, content, match))

if len(found) != 1:
    print(
        f"ERROR: expected exactly 1 collaboration modal, found {len(found)}"
    )

    for path, _, match in found:
        print(f"  FOUND: {path}")
        print(match.group(0)[:1000])

    raise SystemExit(1)

path, content, match = found[0]

modal = match.group(0)

# Remove the title prop regardless of whether the source uses
# single quotes, double quotes, or different whitespace.
title_pattern = re.compile(
    r"^[ \t]*title\s*=\s*(?:\"[^\"]*\"|'[^']*'|\{[^}]*\})[ \t]*\n",
    re.MULTILINE,
)

title_matches = list(title_pattern.finditer(modal))

if len(title_matches) != 1:
    print(
        f"ERROR: expected exactly 1 title prop inside the collaboration "
        f"modal, found {len(title_matches)}"
    )
    print()
    print("Actual collaboration Modal:")
    print(modal)
    raise SystemExit(1)

updated_modal = title_pattern.sub("", modal, count=1)

content = (
    content[:match.start()]
    + updated_modal
    + content[match.end():]
)

path.write_text(content, encoding="utf-8")

print(f"OK: {path}")
print("  Removed the collaboration modal title.")
print("  Icon, description, buttons, and behavior were left unchanged.")

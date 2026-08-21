#!/usr/bin/env python3

from pathlib import Path

path = Path("src/design-system/components/Modal/Modal.css")
content = path.read_text(encoding="utf-8")

# My previous script accidentally inserted the literal string "\\1"
# into the CSS. Remove it if present.
if "\\1" in content:
    content = content.replace("\\1\n", "", 1)
    print("OK: removed accidental literal \\\\1 from Modal.css")
else:
    print("INFO: no accidental \\\\1 found")

# Make sure the modal icon rule contains the required 50px sizing.
start = content.find(".ds-modal__icon svg")

if start == -1:
    print("ERROR: .ds-modal__icon svg selector was not found.")
    raise SystemExit(1)

brace_start = content.find("{", start)
brace_end = content.find("}", brace_start)

if brace_start == -1 or brace_end == -1:
    print("ERROR: Could not locate the modal icon CSS block.")
    raise SystemExit(1)

new_rule = """ .ds-modal__icon svg {
    inline-size: 50px !important;
    block-size: 50px !important;
    width: 50px !important;
    height: 50px !important;
    color: inherit;
  }"""

# Preserve the indentation used by the surrounding stylesheet.
selector_start = start
selector_end = brace_end + 1

content = (
    content[:selector_start]
    + new_rule
    + content[selector_end:]
)

path.write_text(content, encoding="utf-8")

print("OK: modal icon rule is now:")
print("  inline-size: 50px !important")
print("  block-size: 50px !important")
print("  width: 50px !important")
print("  height: 50px !important")

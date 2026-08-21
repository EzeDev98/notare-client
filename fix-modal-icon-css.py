#!/usr/bin/env python3

from pathlib import Path

path = Path("src/design-system/components/Modal/Modal.css")
content = path.read_text(encoding="utf-8")

old = """  /*
   * Size override + `color: inherit`, same pattern used everywhere else
   * an icon sits in an accent-colored badge: `.lucide` sets both directly
   * on the svg in the base layer, which blocks inheriting either the
   * bigger badge size or the badge's accent color from `.ds-modal__icon`
   * above. Without this the icon would render at the standard 20px in
   * flat muted gray instead of standing out the way the badge intends.
   */
  \\1
    inline-size: 50px !important;
    block-size: 50px !important;
    width: 50px !important;
    height: 50px !important;
    color: inherit;\\3
"""

new = """  /*
   * Force every modal icon to exactly 50px.
   *
   * !important is intentional because the global `.lucide` rule sets
   * width/height directly on the SVG and can otherwise override the
   * modal's intended icon size.
   */
  .ds-modal__icon svg {
    inline-size: 50px !important;
    block-size: 50px !important;
    width: 50px !important;
    height: 50px !important;
    color: inherit;
  }
"""

if old not in content:
    print("ERROR: The broken modal icon block was not found.")
    print("No changes were made.")
    raise SystemExit(1)

content = content.replace(old, new, 1)

path.write_text(content, encoding="utf-8")

print("OK: repaired Modal.css")
print("OK: every .ds-modal__icon svg is forced to 50px")
print("OK: width/height are !important")
print("OK: existing icon color is preserved")

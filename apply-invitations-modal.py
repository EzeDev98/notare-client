#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/Invitations/Invitations.tsx")
content = path.read_text(encoding="utf-8")

content = content.replace(
    "import { X } from 'lucide-react';",
    "import { Mail } from 'lucide-react';",
)

old_reject = """        icon={<X aria-hidden="true" />}
        title="Reject this invite?"
        description="You won't get access to this invitation."
"""

new_reject = """        icon={<Mail aria-hidden="true" />}
        description="Reject this invite? You won't get access to this invitation."
"""

if content.count(old_reject) != 1:
    raise SystemExit("Expected received-invite rejection modal exactly once")

content = content.replace(old_reject, new_reject, 1)

old_cancel = """        icon={<X aria-hidden="true" />}
        title="Cancel this invite?"
        description="This invitation will no longer be available to the recipient."
"""

new_cancel = """        icon={<Mail aria-hidden="true" />}
        description="Cancel this invite? This invitation will no longer be available to the recipient."
"""

if content.count(old_cancel) != 1:
    raise SystemExit("Expected sent-invite cancellation modal exactly once")

content = content.replace(old_cancel, new_cancel, 1)

content = content.replace("        destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: Invitations.tsx")

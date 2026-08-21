#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/Notifications/Notifications.tsx")
content = path.read_text(encoding="utf-8")

content = content.replace(
    "import { Trash2, X } from 'lucide-react';",
    "import { Bell, Mail } from 'lucide-react';",
)

old_delete = """        <Modal
          icon={<Trash2 aria-hidden="true" />}
          title="Delete this notification?"
          description="This can't be undone."
"""

new_delete = """        <Modal
          icon={<Bell aria-hidden="true" />}
          description="Delete this notification? This can't be undone."
"""

if content.count(old_delete) != 1:
    raise SystemExit("Expected notification delete modal exactly once")

content = content.replace(old_delete, new_delete, 1)

old_reject = """        <Modal
          icon={<X aria-hidden="true" />}
          title="Reject this invite?"
          description={
            confirmingReject.targetLabel.trim() !== '' ? (
              <>
                You won't get access to <strong>{confirmingReject.targetLabel}</strong>.
              </>
            ) : (
              <>You won't get access to this invitation.</>
            )
          }
"""

new_reject = """        <Modal
          icon={<Mail aria-hidden="true" />}
          description={
            confirmingReject.targetLabel.trim() !== '' ? (
              <>
                Reject this invite? You won't get access to{' '}
                <strong>{confirmingReject.targetLabel}</strong>.
              </>
            ) : (
              <>Reject this invite? You won't get access to this invitation.</>
            )
          }
"""

if content.count(old_reject) != 1:
    raise SystemExit("Expected notification invite-rejection modal exactly once")

content = content.replace(old_reject, new_reject, 1)
content = content.replace("          destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: Notifications.tsx")

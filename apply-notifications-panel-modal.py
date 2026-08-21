#!/usr/bin/env python3

from pathlib import Path

path = Path(
    "src/features/notifications/components/NotificationsPanel/NotificationsPanel.tsx"
)
content = path.read_text(encoding="utf-8")

# Change the icon imports to Bell/Mail where the panel currently uses
# Trash2/X for confirmation modals.
content = content.replace(
    "import { Trash2, X } from 'lucide-react';",
    "import { Bell, Mail } from 'lucide-react';",
)

# Delete notification modal.
content = content.replace(
    """icon={<Trash2 aria-hidden="true" />}
          title="Delete this notification?"
          description="This can't be undone."
""",
    """icon={<Bell aria-hidden="true" />}
          description="Delete this notification? This can't be undone."
""",
)

# Reject invitation modal.
content = content.replace(
    """icon={<X aria-hidden="true" />}
          title="Reject this invite?"
""",
    """icon={<Mail aria-hidden="true" />}
""",
)

# Merge the title into the invitation description.
content = content.replace(
    """You won't get access to <strong>{confirmingReject.targetLabel}</strong>.
""",
    """Reject this invite? You won't get access to{' '}
                <strong>{confirmingReject.targetLabel}</strong>.
""",
)

content = content.replace(
    """<>You won't get access to this invitation.</>
""",
    """<>Reject this invite? You won't get access to this invitation.</>
""",
)

content = content.replace("          destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: NotificationsPanel.tsx")

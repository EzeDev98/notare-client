#!/usr/bin/env python3

from pathlib import Path

path = Path("src/pages/Sessions/Sessions.tsx")
content = path.read_text(encoding="utf-8")

content = content.replace(
    "import { LogOut, ShieldAlert } from 'lucide-react';",
    "import { LogOut, MonitorSmartphone } from 'lucide-react';",
)

content = content.replace(
    "<ShieldAlert aria-hidden=\"true\" />",
    "<MonitorSmartphone aria-hidden=\"true\" />",
)

old = """          title={
            confirmingSession.current
              ? 'Sign out from this device?'
              : 'Revoke this session?'
          }
          description={
            confirmingSession.current ? (
              <>
                You will be signed out of this device and returned to the
                login screen.
              </>
            ) : (
              <>
                This device or browser will no longer be able to access your
                Notare account using this session.
              </>
            )
          }
"""

new = """          description={
            confirmingSession.current ? (
              <>
                Sign out from this device? You will be signed out and returned
                to the login screen.
              </>
            ) : (
              <>
                Revoke this session? This device or browser will no longer be
                able to access your Notare account using this session.
              </>
            )
          }
"""

if content.count(old) != 1:
    raise SystemExit("Expected session confirmation block exactly once")

content = content.replace(old, new, 1)

old_all = """          title="Sign out everywhere?"
          description={
            <>
              This will end every active session, including the device you are
              using now. You will need to sign in again.
            </>
          }
"""

new_all = """          description={
            <>
              Sign out everywhere? This will end every active session,
              including the device you are using now. You will need to sign
              in again.
            </>
          }
"""

if content.count(old_all) != 1:
    raise SystemExit("Expected sign-out-everywhere block exactly once")

content = content.replace(old_all, new_all, 1)
content = content.replace("          destructive\n", "")

path.write_text(content, encoding="utf-8")

print("Done: Sessions.tsx")

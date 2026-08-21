#!/usr/bin/env python3

from pathlib import Path

path = Path("src/features/voice/components/VoiceRecorder/VoiceRecorder.tsx")
content = path.read_text(encoding="utf-8")

old = """      {confirmingDiscard ? (
        <Modal
          icon={<Trash2 aria-hidden="true" />}
          title="Discard this recording?"
          description="It hasn't been saved yet — this can't be undone."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setConfirmingDiscard(null);
            },
          }}
          primaryAction={{
            label: 'Discard',
            onClick: confirmDiscard,
          }}
          onClose={() => {
            setConfirmingDiscard(null);
          }}
        />
      ) : null}
"""

new = """      {confirmingDiscard ? (
        <Modal
          icon={<Mic aria-hidden="true" />}
          description="Discard this recording? It hasn't been saved yet — this can't be undone."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setConfirmingDiscard(null);
            },
          }}
          primaryAction={{
            label: 'Discard',
            onClick: confirmDiscard,
          }}
          onClose={() => {
            setConfirmingDiscard(null);
          }}
        />
      ) : null}
"""

count = content.count(old)

if count != 1:
    print(f"ERROR: expected exactly 1 matching VoiceRecorder modal, found {count}")
    print("No changes were made.")
    raise SystemExit(1)

content = content.replace(old, new, 1)
path.write_text(content, encoding="utf-8")

print("OK: VoiceRecorder.tsx")
print("  - Trash2 -> Mic")
print("  - removed separate title")
print("  - moved full confirmation copy into description")

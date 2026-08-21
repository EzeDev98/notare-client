#!/usr/bin/env python3

from pathlib import Path

path = Path("src/features/voice/components/VoiceRecorder/VoiceRecorder.tsx")
content = path.read_text(encoding="utf-8")

# Modal import
old_import = """import { Button } from '@/design-system/components/Button/Button';
import './VoiceRecorder.css';
"""

new_import = """import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import './VoiceRecorder.css';
"""

if old_import in content:
    content = content.replace(old_import, new_import, 1)

# Confirmation state
old_state = """  const recorder = useMediaRecorderState();
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
"""

new_state = """  const recorder = useMediaRecorderState();
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [confirmingDiscard, setConfirmingDiscard] = useState<
    'recording' | 'stopped' | null
  >(null);
"""

if old_state in content:
    content = content.replace(old_state, new_state, 1)

# Confirmation handler
old_handler = """  function handleDiscardWhileRecording() {
    discardOnStopRef.current = true;
    recorder.stop();
  }

  function handleSendWhileRecording() {
"""

new_handler = """  function handleDiscardWhileRecording() {
    discardOnStopRef.current = true;
    recorder.stop();
  }

  function confirmDiscard() {
    if (confirmingDiscard === 'recording') {
      handleDiscardWhileRecording();
    } else if (confirmingDiscard === 'stopped') {
      recorder.reset();
    }

    setConfirmingDiscard(null);
  }

  function handleSendWhileRecording() {
"""

if old_handler in content:
    content = content.replace(old_handler, new_handler, 1)

# Recording-state discard button
content = content.replace(
    """            onClick={handleDiscardWhileRecording}
            aria-label="Discard recording"
""",
    """            onClick={() => {
              setConfirmingDiscard('recording');
            }}
            aria-label="Discard recording"
""",
    1,
)

# Stopped-state discard button
content = content.replace(
    """            onClick={recorder.reset}
            disabled={upload.isPending}
            aria-label="Discard recording"
""",
    """            onClick={() => {
              setConfirmingDiscard('stopped');
            }}
            disabled={upload.isPending}
            aria-label="Discard recording"
""",
    1,
)

# Modal at the end
old_end = """          aria-label="Record a voice note"
        >
          <Mic aria-hidden="true" color="var(--color-text-on-accent)" />
        </button>
      ) : null}
    </div>
  );
}
"""

new_end = """          aria-label="Record a voice note"
        >
          <Mic aria-hidden="true" color="var(--color-text-on-accent)" />
        </button>
      ) : null}

      {confirmingDiscard ? (
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
    </div>
  );
}
"""

if old_end not in content:
    raise SystemExit("Could not find VoiceRecorder modal insertion point")

content = content.replace(old_end, new_end, 1)

path.write_text(content, encoding="utf-8")

print("Done: VoiceRecorder.tsx")

#!/usr/bin/env python3
"""
Run from the repo root: python3 apply-modal-updates.py

1) Removes the `destructive` (red/danger) treatment from Modal so every
   confirmation dialog renders with the standard lavender/purple primary
   button, matching the reference screenshot.
2) Adds a confirm-before-discard Modal to VoiceRecorder's two trash
   buttons (while recording, and after stopping), which previously
   discarded instantly with no confirmation.
"""
import re
import sys

def replace_once(path, old, new, label):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count != 1:
        print(f"  SKIP ({count} matches, expected 1): {label} in {path}")
        return False
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK: {label} in {path}")
    return True

def strip_destructive_lines(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    new_content, n = re.subn(r"[ \t]*destructive\n", "", content)
    if n == 0:
        print(f"  SKIP (no 'destructive' prop found): {path}")
        return False
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"  OK: removed {n} 'destructive' line(s) in {path}")
    return True


print("Step 1/2: Modal.tsx — drop the destructive prop entirely")
modal_path = "src/design-system/components/Modal/Modal.tsx"

replace_once(
    modal_path,
    """  primaryAction: ModalAction;
  /** Left-hand, outlined button. Omit for a single-button alert. */
  secondaryAction?: ModalAction;
  /**
   * Gives the primary action the danger treatment instead of the
   * default lavender/purple treatment.
   */
  destructive?: boolean;
  onClose: () => void;
}""",
    """  primaryAction: ModalAction;
  /** Left-hand, outlined button. Omit for a single-button alert. */
  secondaryAction?: ModalAction;
  onClose: () => void;
}""",
    "interface: remove `destructive` prop",
)

replace_once(
    modal_path,
    """export function Modal({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  destructive = false,
  onClose,
}: ModalProps) {""",
    """export function Modal({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  onClose,
}: ModalProps) {""",
    "destructuring: remove `destructive`",
)

replace_once(
    modal_path,
    """          ) : (
            <Button
              autoFocus
              variant={destructive ? 'danger' : 'primary'}
              className="ds-modal__action"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}""",
    """          ) : (
            <Button
              autoFocus
              variant="primary"
              className="ds-modal__action"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}""",
    "button: always lavender/primary, never danger",
)

print()
print("Step 2/2: remove the `destructive` prop from every call site")
call_sites = [
    "src/app/layouts/AppLayout.tsx",
    "src/pages/Trash/Trash.tsx",
    "src/pages/Sessions/Sessions.tsx",
    "src/pages/ShareNote/ShareNote.tsx",
    "src/pages/ShareVoiceNote/ShareVoiceNote.tsx",
    "src/pages/Notifications/Notifications.tsx",
    "src/pages/VoiceDetail/VoiceDetail.tsx",
    "src/features/notes/components/NoteCard/NoteCard.tsx",
    "src/features/voice/components/VoiceNoteCard/VoiceNoteCard.tsx",
    "src/features/notifications/components/NotificationsPanel/NotificationsPanel.tsx",
]
for path in call_sites:
    strip_destructive_lines(path)

print()
print("Step 3/3: VoiceRecorder.tsx — confirm before discarding a recording")
vr_path = "src/features/voice/components/VoiceRecorder/VoiceRecorder.tsx"

replace_once(
    vr_path,
    """import { useMediaRecorderState } from '@/features/voice/hooks/useMediaRecorderState';
import { Button } from '@/design-system/components/Button/Button';
import './VoiceRecorder.css';""",
    """import { useMediaRecorderState } from '@/features/voice/hooks/useMediaRecorderState';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import './VoiceRecorder.css';""",
    "import Modal",
)

replace_once(
    vr_path,
    """  const recorder = useMediaRecorderState();
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);""",
    """  const recorder = useMediaRecorderState();
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // Which trash button opened the confirmation, so the single Modal below
  // knows which underlying discard to actually run once confirmed \u2014 the
  // two trash buttons (recording vs. stopped) discard through different
  // paths (stop-then-reset vs. an immediate reset), same as
  // handleDiscardWhileRecording/recorder.reset did before this modal
  // existed. null means the modal is closed.
  const [confirmingDiscard, setConfirmingDiscard] = useState<'recording' | 'stopped' | null>(
    null,
  );""",
    "add confirmingDiscard state",
)

replace_once(
    vr_path,
    """  function handleDiscardWhileRecording() {
    discardOnStopRef.current = true;
    recorder.stop();
  }

  function handleSendWhileRecording() {""",
    """  function handleDiscardWhileRecording() {
    discardOnStopRef.current = true;
    recorder.stop();
  }

  // Runs the discard the trash button actually asked for, once the person
  // has confirmed it in the Modal \u2014 see confirmingDiscard's own comment
  // above for why there are two different underlying actions here.
  function confirmDiscard() {
    if (confirmingDiscard === 'recording') {
      handleDiscardWhileRecording();
    } else if (confirmingDiscard === 'stopped') {
      recorder.reset();
    }
    setConfirmingDiscard(null);
  }

  function handleSendWhileRecording() {""",
    "add confirmDiscard()",
)

replace_once(
    vr_path,
    """            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={handleDiscardWhileRecording}
            aria-label="Discard recording\"""",
    """            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={() => {
              setConfirmingDiscard('recording');
            }}
            aria-label="Discard recording\"""",
    "recording-state trash button opens confirm",
)

replace_once(
    vr_path,
    """            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={recorder.reset}
            disabled={upload.isPending}
            aria-label="Discard recording\"""",
    """            className="voice-recorder__bar-btn voice-recorder__bar-btn--danger"
            onClick={() => {
              setConfirmingDiscard('stopped');
            }}
            disabled={upload.isPending}
            aria-label="Discard recording\"""",
    "stopped-state trash button opens confirm",
)

replace_once(
    vr_path,
    """          aria-label="Record a voice note"
        >
          <Mic aria-hidden="true" color="var(--color-text-on-accent)" />
        </button>
      ) : null}
    </div>
  );
}""",
    """          aria-label="Record a voice note"
        >
          <Mic aria-hidden="true" color="var(--color-text-on-accent)" />
        </button>
      ) : null}

      {confirmingDiscard ? (
        <Modal
          icon={<Trash2 aria-hidden="true" />}
          title="Discard this recording?"
          description="It hasn't been saved yet \u2014 this can't be undone."
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
}""",
    "render the discard confirmation modal",
)

print()
print("Done. Review with `git diff`, then run your typecheck/lint before committing.")

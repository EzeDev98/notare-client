#!/usr/bin/env python3
"""
Run from the repo root: python3 apply-modal-icons-no-title.py

Removes the title from every Modal (description is now the dialog's only
copy, and doubles as its accessible name), and swaps each modal's icon to
represent the OBJECT the action is about rather than the generic action —
e.g. a note delete uses a note icon instead of a trash can, a voice note
delete/discard uses a mic instead of a trash can, and anything about an
invitation uses an envelope instead of an X. Icon size goes from 28px to
50px in a larger 72px badge; stroke width already inherits 1.25 from the
app-wide `.lucide` base rule in tokens/icons.css, so nothing needed
changing there.

Covers: Modal.tsx, Modal.css, AppLayout.tsx, NoteCard.tsx, Trash.tsx,
VoiceNoteCard.tsx, VoiceDetail.tsx, VoiceRecorder.tsx, Sessions.tsx,
ShareNote.tsx, ShareVoiceNote.tsx, Invitations.tsx.

NOT covered (deliberately left for later): Notifications.tsx,
NotificationsPanel.tsx, InviteCollaborator.tsx still pass `title` and
still use their old icons — running this script will make those three
files fail to typecheck (Modal no longer accepts `title`) until they're
updated the same way in a follow-up patch.

Depends on apply-modal-updates.py, apply-modal-shape-update.py,
apply-modal-button-radius.py, and apply-modal-link-fix.py having already
been run.
"""

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


print("Modal.tsx — remove title entirely")
path = "src/design-system/components/Modal/Modal.tsx"

replace_once(
    path,
    """   * Rendered inside a tinted rounded-square badge above the title. Omit
   * entirely for a text-only alert — the badge only renders when this is
   * passed.
   */
  icon?: ReactNode;
  title: string;
  /**
   * Optional body copy under the title. Accepts a node (not just a string)
   * so a caller can bold a name inline, same as InviteCollaboratorPage's
   * existing modal text does with `<strong>`.
   */
  description?: ReactNode;""",
    """   * Rendered inside a tinted rounded-square badge above the description.
   * Choose it for the OBJECT the action is about (a note, a voice note, an
   * invite), not the generic action — a delete confirmation for a voice
   * note uses `<Mic />`, not `<Trash2 />`, since the icon is what tells
   * a skimming reader what kind of thing is on the line before they've
   * read a word. Omit entirely for a text-only alert — the badge only
   * renders when this is passed.
   */
  icon?: ReactNode;
  /**
   * The dialog's only copy — there is no separate title. Accepts a node
   * (not just a string) so a caller can bold a name inline, same as
   * InviteCollaboratorPage's existing modal text does with `<strong>`.
   * Doubles as the dialog's accessible name via `aria-labelledby` below,
   * since there's no heading element to point to instead.
   */
  description?: ReactNode;""",
    "interface: drop title prop",
)

replace_once(
    path,
    """ * title/description, two equal-width buttons side by side. Modeled directly""",
    """ * description, two equal-width buttons side by side. No separate title —
 * the icon badge is what identifies which object the action is about, and
 * the description carries the whole message on its own. Modeled directly""",
    "doc comment: no separate title",
)

replace_once(
    path,
    """export function Modal({
  icon,
  title,
  description,""",
    """export function Modal({
  icon,
  description,""",
    "destructuring: drop title",
)

replace_once(
    path,
    """        aria-labelledby="ds-modal-title"
        aria-describedby={description ? 'ds-modal-description' : undefined}
      >
        {icon ? (
          <div className="ds-modal__icon" aria-hidden="true">
            {icon}
          </div>
        ) : null}

        <h2 id="ds-modal-title" className="ds-modal__title">
          {title}
        </h2>

        {description ? (""",
    """        aria-labelledby={description ? 'ds-modal-description' : undefined}
      >
        {icon ? (
          <div className="ds-modal__icon" aria-hidden="true">
            {icon}
          </div>
        ) : null}

        {description ? (""",
    "JSX: remove heading, repoint aria-labelledby at description",
)

print()
print("Modal.css — 72px badge, 50px icon, drop dead .ds-modal__title rule")
css_path = "src/design-system/components/Modal/Modal.css"

replace_once(
    css_path,
    """    inline-size: 56px;
    block-size: 56px;""",
    """    inline-size: 72px;
    block-size: 72px;""",
    "badge size 56px -> 72px",
)

replace_once(
    css_path,
    """  /*
   * Size override + `color: inherit`, same pattern used everywhere else
   * an icon sits in an accent-colored badge: `.lucide` sets both directly
   * on the svg in the base layer, which blocks inheriting either the
   * bigger badge size or the badge's accent color from `.ds-modal__icon`
   * above. Without this the icon would render at the standard 20px in
   * flat muted gray instead of standing out the way the badge intends.
   */
  .ds-modal__icon svg {
    inline-size: 28px;
    block-size: 28px;
    color: inherit;
  }

  .ds-modal__title {
    margin: 0;
    color: var(--color-text);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
  }

  .ds-modal__description {""",
    """  /*
   * 50px, deliberately large relative to the 72px badge, and NO
   * stroke-width override here — `.lucide` in tokens/icons.css already
   * sets `stroke-width: 1.25` for every icon in the app by default, so
   * this inherits that same light stroke automatically rather than this
   * file needing its own copy of the number to keep in sync.
   *
   * `color: inherit` is the other half of the size override, same pattern
   * used everywhere else an icon sits in an accent-colored badge:
   * `.lucide` sets both `inline-size`/`block-size` AND `color` directly
   * on the svg in the base layer, which blocks inheriting either the
   * bigger badge size or the badge's accent color from `.ds-modal__icon`
   * above. Without this the icon would render at the standard 20px in
   * flat muted gray instead of the badge's own lavender.
   */
  .ds-modal__icon svg {
    inline-size: 50px;
    block-size: 50px;
    color: inherit;
  }

  .ds-modal__description {""",
    "icon 28px -> 50px, remove dead .ds-modal__title rule",
)

print()
print("AppLayout.tsx — navbar delete: merge title into description")
replace_once(
    "src/app/layouts/AppLayout.tsx",
    """          title=""
          description={
            <>
              Are you sure you want to delete
              <br />
              the selected note?
            </>
          }""",
    """          description="Delete this note? It will be moved to Trash."""" + '"',
    "merge title/description",
)

print()
print("NoteCard.tsx — note icon instead of trash can, merge copy")
replace_once(
    "src/features/notes/components/NoteCard/NoteCard.tsx",
    "import { Trash2 } from 'lucide-react';",
    "import { NotebookPen } from 'lucide-react';",
    "import NotebookPen instead of Trash2",
)
replace_once(
    "src/features/notes/components/NoteCard/NoteCard.tsx",
    """          icon={<Trash2 aria-hidden="true" />}
          title="Delete this note?"
          description="The note will be moved to Trash."""" + '"',
    """          icon={<NotebookPen aria-hidden="true" />}
          description="Delete this note? It will be moved to Trash."""" + '"',
    "icon + merged copy",
)

print()
print("Trash.tsx — note icon instead of trash can, merge copy")
replace_once(
    "src/pages/Trash/Trash.tsx",
    "import { Trash2 } from 'lucide-react';",
    "import { NotebookPen } from 'lucide-react';",
    "import NotebookPen instead of Trash2",
)
replace_once(
    "src/pages/Trash/Trash.tsx",
    """          icon={<Trash2 aria-hidden="true" />}
          title="Delete note forever?"
          description={
            <>
              <strong>
                {confirmingNote.title.trim() || 'Untitled'}
              </strong>{' '}
              will be permanently deleted. This action cannot be undone.
            </>
          }""",
    """          icon={<NotebookPen aria-hidden="true" />}
          description={
            <>
              Delete{' '}
              <strong>{confirmingNote.title.trim() || 'Untitled'}</strong>{' '}
              forever? This action cannot be undone.
            </>
          }""",
    "icon + merged copy",
)

print()
print("VoiceNoteCard.tsx — mic icon instead of trash can, merge copy")
replace_once(
    "src/features/voice/components/VoiceNoteCard/VoiceNoteCard.tsx",
    "import { Trash2 } from 'lucide-react';",
    "import { Mic } from 'lucide-react';",
    "import Mic instead of Trash2",
)
replace_once(
    "src/features/voice/components/VoiceNoteCard/VoiceNoteCard.tsx",
    """          icon={<Trash2 aria-hidden="true" />}
          title="Delete this voice note?"
          description="This recording will be permanently deleted. This action cannot be undone."""" + '"',
    """          icon={<Mic aria-hidden="true" />}
          description="Delete this voice note? It will be permanently deleted and can't be undone."""" + '"',
    "icon + merged copy",
)

print()
print("VoiceDetail.tsx — mic icon instead of trash can, merge copy")
replace_once(
    "src/pages/VoiceDetail/VoiceDetail.tsx",
    "import { Share, Trash2 } from 'lucide-react';",
    "import { Mic, Share } from 'lucide-react';",
    "import Mic instead of Trash2",
)
replace_once(
    "src/pages/VoiceDetail/VoiceDetail.tsx",
    """              icon={<Trash2 aria-hidden="true" />}
              title="Delete this voice note?"
              description="This voice note will be permanently deleted. This action cannot be undone."""" + '"',
    """              icon={<Mic aria-hidden="true" />}
              description="Delete this voice note? It will be permanently deleted and can't be undone."""" + '"',
    "icon + merged copy",
)

print()
print("VoiceRecorder.tsx — mic icon instead of trash can, merge copy")
replace_once(
    "src/features/voice/components/VoiceRecorder/VoiceRecorder.tsx",
    """          icon={<Trash2 aria-hidden="true" />}
          title="Discard this recording?"
          description="It hasn't been saved yet — this can't be undone."""" + '"',
    """          icon={<Mic aria-hidden="true" />}
          description="Discard this recording? It hasn't been saved yet — this can't be undone."""" + '"',
    "icon + merged copy (Trash2 import stays — still used by the trigger buttons)",
)

print()
print("Sessions.tsx — merge titles into description (icons already correct)")
replace_once(
    "src/pages/Sessions/Sessions.tsx",
    """          title={
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
          }""",
    """          description={
            confirmingSession.current ? (
              <>
                Sign out from this device? You'll be signed out and returned
                to the login screen.
              </>
            ) : (
              <>
                Revoke this session? This device or browser will no longer be
                able to access your Notare account using this session.
              </>
            )
          }""",
    "merge per-session title/description",
)
replace_once(
    "src/pages/Sessions/Sessions.tsx",
    """          title="Sign out everywhere?"
          description={
            <>
              This will end every active session, including the device you are
              using now. You will need to sign in again.
            </>
          }""",
    """          description={
            <>
              Sign out everywhere? This will end every active session,
              including the device you are using now. You will need to sign
              in again.
            </>
          }""",
    "merge sign-out-everywhere title/description",
)

print()
print("ShareNote.tsx / ShareVoiceNote.tsx — merge title into description (icon already correct)")
replace_once(
    "src/pages/ShareNote/ShareNote.tsx",
    """          title="Remove this collaborator?"
          description={
            <>
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong> will lose access to
              this note.
            </>
          }""",
    """          description={
            <>
              Remove this collaborator?{' '}
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong>{' '}
              will lose access to this note.
            </>
          }""",
    "merge copy",
)
replace_once(
    "src/pages/ShareVoiceNote/ShareVoiceNote.tsx",
    """          title="Remove this collaborator?"
          description={
            <>
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong> will lose access to
              this voice note.
            </>
          }""",
    """          description={
            <>
              Remove this collaborator?{' '}
              <strong>{resolveName(confirmingRevoke.sharedWithUserId)}</strong>{' '}
              will lose access to this voice note.
            </>
          }""",
    "merge copy",
)

print()
print("Invitations.tsx — envelope icon instead of X, merge copy (both modals)")
replace_once(
    "src/pages/Invitations/Invitations.tsx",
    "import { X } from 'lucide-react';",
    "import { Mail } from 'lucide-react';",
    "import Mail instead of X",
)
replace_once(
    "src/pages/Invitations/Invitations.tsx",
    """        icon={<X aria-hidden="true" />}
        title="Reject this invite?"
        description="You won't get access to this invitation."""" + '"',
    """        icon={<Mail aria-hidden="true" />}
        description="Reject this invite? You won't get access to this invitation."""" + '"',
    "reject modal: icon + merged copy",
)
replace_once(
    "src/pages/Invitations/Invitations.tsx",
    """        icon={<X aria-hidden="true" />}
        title="Cancel this invite?"
        description="This invitation will no longer be available to the recipient."""" + '"',
    """        icon={<Mail aria-hidden="true" />}
        description="Cancel this invite? This invitation will no longer be available to the recipient."""" + '"',
    "cancel modal: icon + merged copy",
)

print()
print("Done. Modal no longer accepts `title` — Notifications.tsx, NotificationsPanel.tsx, and")
print("InviteCollaborator.tsx still pass it and will fail to typecheck until a follow-up patch")
print("updates them the same way. Review with `git diff`, then run your typecheck before committing.")

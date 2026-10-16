# Collaboration: the two-device test (step 16 gate)

Run this on two real devices, or two browsers, against staging. Call them A and B.
A is the owner. B is signed in as the person the note is shared with.

Before you start:
- Both devices run the same client build and point at the same staging server.
- Share one note from A to B with Editor access, and open it on both.
- Keep DevTools open on B for the Viewer check.

Tick each line only when you saw it happen. If one fails, write what you saw next to it.

## 1. Both online
- [ ] Type in A. The text shows in B within about a second.
- [ ] Type in B. The text shows in A within about a second.
- [ ] Each device shows the other person's caret, with their name and colour.
- [ ] Neither caret jumps while the other person types or the text above it changes.
- [ ] Your own caret stays where you left it while the other person types.

## 2. One device offline, both typing
- [ ] Put B offline (airplane mode, or DevTools > Network > Offline).
- [ ] Type different text in A and in B, in different places and in the same place.
- [ ] Bring B online.
- [ ] Both texts end up in the note on both devices. Nothing is overwritten or lost.
- [ ] B shows "Merging changes", then "Synced".
- [ ] B shows the right toast once, not repeatedly.
- [ ] A and B show identical text after merging.

## 3. App closed with unsent edits
- [ ] Put B offline and type some edits.
- [ ] Close B's tab or app completely while still offline.
- [ ] Reopen B online and open the note.
- [ ] B's edits arrive and show on A.
- [ ] B's edits are still on B, nothing is dropped.

## 4. Owner downgrades B to Viewer
- [ ] On A, change B from Editor to Viewer.
- [ ] B turns read-only at once, without a reload.
- [ ] B keeps the text it had, including its last edit.
- [ ] B can no longer type, and B's caret and toolbar show the read-only state.
- [ ] A still sees B's last edit.

## 5. Owner removes B
- [ ] On A, remove B from the note.
- [ ] B leaves the note within a second and lands on the notes list.
- [ ] B sees the "access removed" message.
- [ ] The note is gone from B's "Shared with me".
- [ ] Opening the note's address on B shows no content.

## 6. A Viewer cannot change the text
- [ ] With B as Viewer, open DevTools on B and try to make the page editable
      (for example set `contenteditable` on the editor, or call the editor's
      update from the console).
- [ ] Type in the edited page.
- [ ] A does not receive the change. The server rejects it.
- [ ] Reload B. The text is the owner's text, without the DevTools edit.

## 7. Two notes in two tabs on one device
- [ ] On B, open note 1 in one tab and note 2 in another.
- [ ] Type in note 1. Note 2 does not change.
- [ ] Type in note 2. Note 1 does not change.
- [ ] Take one tab offline. The other tab keeps syncing.
- [ ] Each tab shows the right carets for its own note only.

## Result
- Date:
- Client build:
- Server build:
- Devices and browsers:
- Passed: yes / no
- Failures and notes:

Gate: the owner verifies every box above. Then one commit: `Step 16: collaboration client`.

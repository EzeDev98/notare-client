# Notare decisions log

Source of truth: `NOTARE_OVERHAUL_MASTER_copy.md` (v1.1, 9 Oct 2026).
Rule (master section 14, pitfall 20): when a decision changes, edit the master doc and this file in the same commit.

Statuses: AGREED, ADOPTED, BUILT, PROPOSED, OPEN, REJECTED.

## Step 1 decisions

| ID | Date | Decision | Status | Source |
|---|---|---|---|---|
| D-001 | 2026-10-09 | Path layout. Aliases stay `@` = `src/` and `~` = `tests/` (vite.config.ts and tsconfig.app.json); no more are added. Folders: `src/design-system/` (tokens, `components/`, `lib/`, `icons/`, motion added in step 4), `src/app/` (shell, routes, start-up), `src/features/<domain>/` (api, hooks, components, types), `src/pages/<Screen>/`. Existing `src/lib/` (http, db, theme, time, config), `src/shared/`, `src/sync/`, `src/pwa/` stay as they are. New: `src/core/` (timings, route config, adapter) and `src/dev/gallery/` (dev-only gallery). Empty `src/main/` is deleted. `core/` and `dev/` get ESLint boundary rules in step 3. | ADOPTED | Guide 1e, docs/architecture/structure.md |
| D-002 | 2026-10-09 | Transcription provider is Deepgram (server commit ecdad4f). Closes the provider half of O-23. | ADOPTED | Server code |
| D-003 | 2026-10-09 | `POST /admin/database/wipe` exists only when `app.admin.wipe-enabled` is true (false by default, true in dev); the default secret is removed. | ADOPTED | Guide 1b |
| D-004 | 2026-10-09 | `NOTARE-SERVER.md` was partly stale; where doc and code differ, the code wins (B-20). | ADOPTED | Master 0, B-20 |
| D-005 | 2026-10-10 | Tokens follow Ahorra's file: same names, raw `--p-*` palette, `light-dark()` in the semantic layer, `@font-face` in its own `fonts.css` with `font-display: block`. | ADOPTED | Guide 2b to 2f, Ahorra `tokens.css` |
| D-006 | 2026-10-10 | `bridge.css` maps both PatternFly layers (base `--100` tokens and semantic `--default` tokens), with no component styling and no `!important` (master 4.5). Ahorra's `!important` overrides are not adopted. Warning and information use the brand colour. | ADOPTED | Guide 2g, master 4.5 |
| D-007 | 2026-10-10 | `reset.css` and `icons.css` are kept in `src/design-system/tokens/` (guide 2h would delete them, but they hold box-sizing, page-scroll and icon-size rules the app needs). | ADOPTED | Guide 2h |
| D-008 | 2026-10-10 | The old z-index scale (overlay 1000, modal 1010, popover 1050, toast 1100) stays in `legacy-aliases.css`; the new 80 / 90 / 100 / 120 scale takes over when the layout files are rebuilt. | ADOPTED | Guide 2h |

## Decisions from the Q&A round (master 3.1)

| ID | Date | Decision | Status | Source |
|---|---|---|---|---|
| 1 | 2026-10-07 | Accent: dusty lavender `#6B5BB5` light, `#B8ACF0` dark. See O-10. | AGREED | 3.1 |
| 2 | 2026-10-07 | Surfaces: warm paper light (`#FAF8F4`, `#FFFFFF`); warm charcoal dark (`#17151A`, `#201D25`). | AGREED | 3.1 |
| 3 | 2026-10-07 | Reuse everything from Ahorra. Note body is 14/20 (C-10). | AGREED | 3.1 |
| 4 | 2026-10-07 | One responsive shell: list pane plus editor on desktop, single-column drill-in on phone. | AGREED | 3.1 |
| 5 | 2026-10-07 | No permanent toolbar. Markdown shortcuts, one floating selection bar, one + insert menu. | AGREED | 3.1 |
| 6 | 2026-10-07 | List: first line is the title, one-line preview, relative date, mic glyph, grouped by date, search on top, no folders in v1. | AGREED | 3.1 |
| 7 | 2026-10-07 | Status and notifications the way Ahorra does it. | AGREED | 3.1 |
| 8 | 2026-10-07 | A voice clip is an inline block at the cursor, a direct child of its note. | AGREED | 3.1 |
| 9 | 2026-10-07 | Real-time co-editing with Yjs, coloured cursors, presence avatars, offline merge. | AGREED | 3.1 |
| 10 | 2026-10-07 | Share by email, Viewer or Editor, 400px modal, owner can revoke, no public links in v1. | AGREED | 3.1 |
| 11 | 2026-10-07 | Delete goes to Recently deleted for 30 days; toast with Undo, no confirm modal. "Audio only" part superseded by 14. | AGREED | 3.1 |
| 12 | 2026-10-07 | Sharing and live collaboration are in the first round, built after the core. | AGREED | 3.1 |
| 13 | 2026-10-07 | Workflow: Q&A, design doc, approved prototypes, plan with gates, client overhaul, voice re-engineering. | AGREED | 3.1 |
| 14 | 2026-10-09 | Transcription is in v1; transcript belongs to its clip, is searchable, can be copied or inserted. | AGREED | 3.1 |
| 15 | 2026-10-09 | Restored: Archive, Make a copy, devices list, Reset this device, People, all notification types. | AGREED | 3.1 |
| 16 | 2026-10-09 | Backend work in 9.9 is in scope and built, not worked around. | AGREED | 3.1 |
| 17 | 2026-10-09 | Drawer rows: All notes, Shared with me, Archived, Recently deleted, Settings. | PROPOSED | 3.1 |

## Open items (master section 15)

Answered now means the owner choice is recorded here. Any other row keeps the master's recommendation as a default and must be confirmed before the step named.

| ID | Question | Answer or default | Status | Decide before |
|---|---|---|---|---|
| O-01 | Note body size | 14/20 | AGREED | closed |
| O-02 | Dark-mode lavender text contrast | Verify in gallery; lighten to `#C4BAF4` if below 4.5:1 | OPEN | Step 6 |
| O-03 | Bold and Italic in notes | Remove both; keep Link and List | AGREED | answered |
| O-04 | Replace the silent 20,000-character cut | Stated limit with muted counter, never truncate silently | PROPOSED | Step 12 |
| O-05 | Inviting an email with no account | Show as Pending; access starts at sign-in | ADOPTED | answered |
| O-06 | "Voice clip" instead of "voice note" | Use "voice clip" | AGREED | answered |
| O-07 | Pinned notes in v1 | Include | ADOPTED | answered |
| O-08 | Who sees remote cursor names | Editors see names; Viewers see avatars only | PROPOSED | Step 15 |
| O-09 | Logo and app icon | Supplied files exactly | AGREED | answered |
| O-10 | Accent vs logo violet (`#6D28D9`) | Keep `#6B5BB5`. The logo violet stays on the one button that uses it, through `--color-logo` in `legacy-aliases.css` | ADOPTED | answered |
| O-11 | Banners push editor content down | Fixed-height slot under the header, or overlay strip | OPEN | Step 5 |
| O-12 | List row title 16/24 vs body 14/20 | Row title 16/24, preview 14/20 | PROPOSED | Step 5 |
| O-13 | Two-pane threshold | 800px container width | AGREED | answered |
| O-14 | Install step mandatory or skippable | Mandatory only if the app cannot work uninstalled; else "Continue in browser" | OPEN | Step 10 |
| O-15 | PIN on device or with account | Device only (app must open offline) | AGREED | answered |
| O-16 | How the "10 empty notes" appeared | Owner describes timing, offline or online, cache clear | OPEN | Step 8 |
| O-17 | Clips recorded on device first, uploaded later | Confirm; decides local model and upload contract | PROPOSED | Step 8 |
| O-18 | Legal copy (Terms, Privacy) is placeholder | Adapt Ahorra's text; lawyer review before release | OPEN | Step 13 |
| O-19 | Onboarding card mentions `#` formatting | Reword | PROPOSED | Step 5 |
| O-20 | Placeholder text | "Start writing" in editor; longer line only in an empty state | PROPOSED | Step 12 |
| O-21 | People step before sharing | Keep People for v1 | AGREED | answered |
| O-22 | Transcribe automatically or on tap | On tap | AGREED | answered |
| O-23 | Transcription language, provider, cost | Provider is Deepgram (D-002); language and cost still to decide | OPEN | Step 17 |
| O-24 | Editors may transcribe a shared clip | Yes (B-11); Viewers read only | PROPOSED | Step 17 |
| O-25 | Archive as a drawer row | Keep | PROPOSED | Step 11 |
| O-26 | Make a copy includes voice clips | Yes (B-05) | AGREED | answered |
| O-27 | Icons beside drawer rows | None, unless Ahorra's drawer shows them; check its source | OPEN | Step 11 |
| O-28 | Per-person pin on shared notes | Not in v1 | PROPOSED | Step 11 |
| O-29 | Undo and redo strip on phone | Build the strip | PROPOSED | Step 12 |
| O-30 | Devices as its own settings row | Own row | PROPOSED | Step 13 |
| O-31 | Purge grace for notes trashed over 30 days | Release + 7 days | PROPOSED | Step 17 |

## Baseline before the overhaul (git tag `pre-overhaul`, commit 32877da)

Full output: `docs/baseline-typecheck.txt`, `docs/baseline-lint.txt`, `docs/baseline-test.txt`. Anything failing that is not listed here is new.

- Typecheck: clean.
- Lint: 27 errors, 11 warnings. Mostly `self` and `caches` undefined in `service-worker/sw.js`; `vite-plugins/patternflyLayer.ts` and `vite-plugins/serviceWorkerVersion.ts` are not in the tsconfig; two errors in `tests/setup.ts`.
- Tests: 50 of 51 files pass; 404 of 406 tests pass. Both failures are in `src/features/editor/createNote.test.tsx` ("creates nothing until something is typed", "creates exactly one note, then patches it with everything typed since"), with 2 unhandled errors raised from `src/pages/NewNote/NewNote.tsx` line 77.
- Server baseline: see `notare-server/docs/baseline-test.txt` (822 tests, 6 errors).

## Removal list

Files and code scheduled for deletion (add to this list as steps find more):

- `src/app/layouts/AppLayout.tsx` (step 11)
- `src/design-system/legacy-aliases.css`, created in step 2 (step 14)
- `src/design-system/tokens/reset.css`, replaced by a Notare reset (decide at step 3)
- `src/design-system/tokens/icons.css`, replaced when icons move to Lucide (step 6)
- `src/dev/tokens/`, the tokens page, replaced by the gallery (step 6)
- Hex values still in component CSS: listed in `docs/baseline-hex.txt`; each file is cleaned when its screen is rebuilt (steps 6 to 14)

## Step 3 lint rules

- D-009: Stylelint has no `extends`; rules ported from Ahorra. Ahorra's `ignoreMediaFeatureNames` was inverted; Notare uses `{ px: ['/.*/'] }`. Legacy CSS is listed in `LEGACY` in `stylelint.config.js` (35 files). A file leaves the list when its screen is rebuilt (steps 6 to 14); the list must be empty at step 14.
- D-010: ESLint legacy violations are bulk-suppressed in `eslint-suppressions.json` (baseline lint errors, max-lines, PF imports and raw buttons in old components). Run `npx eslint --prune-suppressions` after each rebuild step so the file shrinks. Never run `--suppress-all` again to hide new errors.
- `NoteDetail.css` was missing the closing brace of its `@layer pages` block; fixed in step 3.

### max-lines disabled in the file (3D)

| File | Lines | Removal |
| --- | --- | --- |
| src/app/layouts/AppLayout.tsx | ~1,570 | Deleted in step 11 |
| src/features/notes/local/noteRepository.ts | ~650 | Split in step 8c |
| src/features/voice/components/VoiceRecorder/VoiceRecorder.tsx | ~440 | Deleted in step 12 |

## Stray motion (step 4e)

Files that still animate outside src/design-system/motion. Each is removed when its component is rebuilt (step 6) or its screen (steps 9 to 14).

| File | Lines with transition, animation, @keyframes or .animate |
| --- | --- |

- NOTE_LIFECYCLE_DELAY_MS (220) and its 6 uses in src/app/layouts/AppLayout.tsx: removed when AppLayout.tsx is deleted (step 11).
- src/features/notes/components/AnimatedSidebarNoteList (JS list animation and its CSS): replaced by flip() and rowOut() when the Home list is rebuilt (step 11).

## Step 5a: open decisions that change the prototypes (answered 10 Oct 2026)

| ID | Question | Answer |
| --- | --- | --- |
| O-03 | Bold and Italic in the selection bar | Removed. The bar keeps Link and List. Hierarchy comes from size and colour. |
| O-04 | 20,000-character limit with a CRDT body | Keep a stated limit with a muted counter (hidden below 19,000; "19,420 of 20,000 characters"; "Limit reached. New text is not saved."). Typing past the limit is blocked, never truncated. |
| O-11 | Banners above the editor push content down | A fixed-height, one-line slot under the header. It is always there, so a banner appearing or leaving moves nothing. |
| O-12 | List row title 16/24 vs body 14/20 | Keep the row title at 16/24 and the preview at 14/20. The note body is 14/20. |
| O-13 | Two-pane threshold | 800px container width. |
| O-14 | Install step mandatory or skippable | Skippable: add "Continue in browser". |
| O-21 | People (connection step) before sharing | Keep People for v1. |

## Step 6e: old components and when they go

The old components in src/design-system/components/ and the PatternFly imports stay until the screens that use them are rebuilt. Each one is deleted in the step where its last importer moves to src/design-system/ui/. Anything left after that goes in Step 20.

### Old components

| Old component | Replaced by | Removed in |
|---|---|---|
| Button, BackButton | ui/Button, ui/IconButton, PageHeader | Step 9 to 16, last importer decides |
| TextField, PasswordField, TextArea, Field, Select | ui/TextField, PasswordField, TextArea, FormField, SelectField | Step 9 (auth forms), last use in Step 13 |
| FormAlert | ui/InfoBanner | Step 9 |
| Modal | ui/Overlay | Step 11 to 14, last use decides |
| Toast, app/providers/ToastProvider, toast-context | ui/ToastProvider, useToast | Step 11 (when AppLayout is rebuilt) |
| Spinner, Logo, VisuallyHidden | ui/Spinner, Logo, VisuallyHidden | Step 9 |
| ThemeToggle | Settings screen theme choice | Step 13 |
| layout (old parts) | components/layout PageHeader, ScreenContainer, FormScreen | Step 9 to 11 |

### Screens and the step that migrates them (these hold the old imports and raw buttons)

- Step 9 Auth: Login, Register, ResetPassword, VerifyAccount.
- Step 10 Onboarding and install: pwa/InstallPage, pwa/UpdateAvailableModal.
- Step 11 Home, drawer, search, People, notifications: AppLayout, MobileNotesPanel, navItems, Notes, NotesLanding, Search, Trash, NoteCard, NotificationsPanel, Notifications, Invitations.
- Step 12 Editor and voice: NoteDetail, VoiceDetail, VoiceNotes, NoteContextMenu, NoteTabs, VoiceRecorder, InlineVoiceNote, VoiceNoteCard, AudioPlayer, TranscriptionPanel.
- Step 13 Settings: SettingsPanel, Sessions.
- Step 16 Collaboration client: ShareNote, ShareVoiceNote, SharedNote, SharedNotes, SharedVoiceDetail, SharedVoiceNotes, SharedInlineVoiceNotes, SharedAudioPlayer, CollaboratorPicker, InviteCollaborator.

### PatternFly (A-10)

Not removed in Step 6. 23 files outside design-system/ still import @patternfly/*, so deleting vite-plugins/patternflyLayer.ts, the icon alias block in vite.config.ts, and icons/lucide-patternfly-icons.tsx now would break the build. All three go in Step 20, when the last PatternFly import is gone and the build is checked.

### Lint

The raw <button> rule is clean on every file above today (npm run lint, 0 errors), so no eslint-disable comments were added. If a later step makes the rule stricter, add disable + TODO(step N) then.

## Step 7 decisions

| ID | Date | Decision | Status | Source |
|---|---|---|---|---|
| D-011 | 2026-10-10 | Install stays mandatory (O-14) and the install gate comes before sign-in. Decided in `src/app/startup/decideRoute.ts`; the flag is `INSTALL_MANDATORY` in `useStartup.ts`. Revisit in step 10e. | ADOPTED | Guide 7c |
| D-012 | 2026-10-10 | No `/welcome` screen exists yet, so a signed-out visitor goes to `/sign-in`. Last open note on wide screens is not wired because nothing records it yet. | ADOPTED | Guide 7c |
| D-013 | 2026-10-10 | Route files live in `src/app/` (routes.ts, routeConfig.tsx, router.tsx), as the build guide says. D-001 said `src/core/`; the guide wins for routes. Timings and the adapter are in `src/core/`. | ADOPTED | Guide 7a |
| D-014 | 2026-10-10 | Old timings stay as `LEGACY_*` constants in `timings.ts` until the step that removes the behaviour (8f, U-02). Every other duration lives in `timings.ts`. | ADOPTED | Guide 7b |
| D-015 | 2026-10-10 | One query client: stale 30s, refetch on focus, retry only transient failures (network, timeout, 5xx), at most twice. Spinners use first-load state only, never a background refetch. Rules live in `providers/queryRules.ts`. | ADOPTED | Guide 7d |
| D-016 | 2026-10-10 | One toast host (the step 6 ToastProvider) is mounted above everything. The old `show({ message, action })` API forwards to it until its last caller moves. | ADOPTED | Guide 7e |
| D-017 | 2026-10-10 | The adapter covers the note, voice and shared-note services only. Auth, notifications, sharing, collaboration and user lookup keep their own services. Only `src/core/adapter` may import the three note services. | ADOPTED | Guide 7f |

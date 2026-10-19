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
| O-14 | Install step mandatory or skippable | Mandatory only if the app cannot work uninstalled; else "Continue in browser" | ADOPTED | Step 10 |
| O-15 | PIN on device or with account | Device only (app must open offline) | AGREED | answered |
| O-16 | How the "10 empty notes" appeared | Owner describes timing, offline or online, cache clear | OPEN | Step 8 |
| O-17 | Clips recorded on device first, uploaded later | Confirm; decides local model and upload contract | AGREED | Step 8 |
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
| src/features/notes/local/noteRepository.ts | ~650 | Split in step 8c (done; the file is now a re-export, delete it after one release) |
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
| D-011 | 2026-10-10 | Install is skippable (O-14, decided in step 10e). The install gate comes before sign-in until the app is installed or the person taps "Continue in browser", which saves `install.choice = 'browser'` in the meta table. Decided in `src/app/startup/decideRoute.ts` from `installChoice`, read by `useStartup.ts`. | ADOPTED | Guide 7c |
| D-012 | 2026-10-10 | No `/welcome` screen exists yet, so a signed-out visitor goes to `/sign-in`. Last open note on wide screens is not wired because nothing records it yet. | ADOPTED | Guide 7c |
| D-013 | 2026-10-10 | Route files live in `src/app/` (routes.ts, routeConfig.tsx, router.tsx), as the build guide says. D-001 said `src/core/`; the guide wins for routes. Timings and the adapter are in `src/core/`. | ADOPTED | Guide 7a |
| D-014 | 2026-10-10 | Old timings stay as `LEGACY_*` constants in `timings.ts` until the step that removes the behaviour (8f, U-02). Every other duration lives in `timings.ts`. | ADOPTED | Guide 7b |
| D-015 | 2026-10-10 | One query client: stale 30s, refetch on focus, retry only transient failures (network, timeout, 5xx), at most twice. Spinners use first-load state only, never a background refetch. Rules live in `providers/queryRules.ts`. | ADOPTED | Guide 7d |
| D-016 | 2026-10-10 | One toast host (the step 6 ToastProvider) is mounted above everything. The old `show({ message, action })` API forwards to it until its last caller moves. | ADOPTED | Guide 7e |
| D-017 | 2026-10-10 | The adapter covers the note, voice and shared-note services only. Auth, notifications, sharing, collaboration and user lookup keep their own services. Only `src/core/adapter` may import the three note services. | ADOPTED | Guide 7f |

## Step 8 decisions

| ID | Date | Decision | Status | Source |
|---|---|---|---|---|
| D-018 | 2026-10-10 | A note's identity is its `clientId`, the UUID made on the device. `localId` is that same value used as the Dexie key (equal on every row from database version 4), and `serverId` is only the server's label for it. Before version 4 the two differed for notes that arrived from the server. | ADOPTED | Guide 8a |
| D-019 | 2026-10-10 | Database version 4 adds `clips`, `transcripts`, `shared`, `people` and `notifications`, and puts `role`, `purgeAt`, `ownerName` and `bodyState` on `notes` rows (optional in the type until 8k). The upgrade sets `role = 'owner'` and moves each note's key to its `clientId` (skipping any row where that is ambiguous), carrying its outbox rows. It never deletes or edits unsent content. | ADOPTED | Guide 8b |
| D-020 | 2026-10-10 | A recording is saved on the device first (`clips`, upload state `local`) and the sync engine uploads it after its note has a server id. A failed upload is retried only by "Try again". The queue is `src/sync/clipUpload.ts`. Matches O-17. | ADOPTED | Guide 8j |
| D-021 | 2026-10-10 | What a role may do is decided only in `features/notes/permissions.ts` (nine functions, master 6.3.1). Screens call those functions and never read `role`. `role` is a required field on every note row. | ADOPTED | Guide 8k |

## Step 11: shell and drawer

- D-022 (2026-10-11): `src/app/shell/Shell.tsx` replaces `AppLayout` in the router. Both panes (list, note) stay mounted; CSS from a container query at 800px decides one pane or two (O-13 settled at 800). The phone fade-through is `usePaneTransition`, which asks the layout whether both panes are visible and so spells no width in JS. `useStartSync` carries the sync start that `AppLayout` did. The blank-note cleanup in `AppLayout` is not carried over: drafts from step 8d are never stored until they have content. The drawer's sync line never says "All notes synced" while notes are waiting or the device is offline. The drawer marks the view from `?view=` under `/notes`; opening a note drops the query, so the list pane's own view memory is decided in 11d. | BUILT | Guide 11a, 11b; master 5.1, 5.3
- D-023 (2026-10-11): The list pane reads Dexie only, one live query per view (`useNoteList`); rows are compact `ListItem`s so the "nothing changed" comparison stays cheap. Groups follow calendar days in the person's time zone (Today, Yesterday, the 6 days before, Earlier); Pinned holds the owner's own pins only. Opening a note carries `?view=` in its URL (`ROUTES.inView`), so the drawer and list pane stay on the view the note was opened from. The cloud-off glyph shows only for a note the server refused, or a pending note while the device is offline: a note waiting the usual two seconds to sync is not "not synced". The first-load stagger plays once per list pane, not per view. A pane that is hidden restores its scroll when shown again. | BUILT | Guide 11c, 11d; master 6.3
| D-024 | 2026-10-11 | The list menu does its work in `features/notes/actions/noteActions.ts`: write locally first, then tell the server, no rollback. Delete, Archive and Leave fade the row and glide the rest with `flip()`; Pin and Restore only glide. Because the list is a live query, `useRowChanges` applies the move first and drops it once Dexie agrees. "Make a copy" adds " copy" to the first line, as the prototype does. "Leave this note" is built (modal, toast) but hidden by `FEATURES.leaveNote` until step 17 adds the server call. The old `useDeleteNote`, `useNoteActions` and `useTrash` do the same server work until step 11l deletes them. | ADOPTED | Guide 11g |
| D-025 | 2026-10-11 | Recently deleted shows the banner "Notes here are removed for good after 30 days.", and each row has "N days left" (never below 1, as in the prototype) and a Restore button; restoring glides the rows and says "Note restored". A deleted note does not open. Every view has its empty state from the prototype. `/notes` with no note chosen shows "Select a note" instead of jumping to the first note; the old jump also ran on a phone, because both panes stay mounted. The pen and every "New note" button share `useStartNote`. `NotesLanding.css` leaves the LEGACY list. | ADOPTED | Guide 11h |
| D-026 | 2026-10-11 | The People and Shared with me tables are filled by `refreshPeople` and `refreshShared` (at sign-in, when the device comes back online, and when Shared with me opens); the screens read Dexie only. People are Connected when either side's invite was accepted, and Pending only for invites you sent, with Cancel; invites sent to you are in the bell. `PersonRow` stores `username` and `collaborationId` instead of `email`, because people are shown as @username. Find people uses `useUserSearch` and the collaboration mutations. | ADOPTED | Guide 11i |

## D-027: Notifications are a modal with their own composer (step 11j)
The bell opens a modal over the shell instead of the old /notifications screen. It fetches page 0 only while it is open. `composeNotification` is new and returns the sentence, the meta line and which buttons to show; the old `composeNotificationMessage` and its test stay until 11l deletes the old page. The permission-change notification carries no role, so the role is read from the local shared table and left out of the sentence when the note is not there. Accept and Decline call the server, delete the notification and refresh People. Voice-note notification types read correctly but have no button until step 18.

## D-028: Offline banner sits in the list pane (step 11k, O-11)
The offline banner is an InfoBanner under the list title, in `ListBanners`, as in the home prototype. It does not use the reserved banner slot, so O-11 stays open for the editor banners in step 12. The "Back online. N notes synced." toast uses the most notes that were waiting while offline. The not-synced glyphs disappear as the sync engine marks each note synced; there is no separate fade yet.

## D-029: Old files deleted, with two kept on purpose (step 11l)
The old layout, panels, sidebar list, cards, tabs and the Notes, Search, Shared, Invitations, Notifications, Sessions and voice-sharing pages are deleted once nothing kept imports them. NotesLanding stays because 11h rebuilt it as the "Select a note" screen. ShareNote stays until step 15 because the Share action still opens it. The old list URLs (/archived, /search, /shared, /collaborations, /notifications, /account/sessions) redirect to the new views for one release. /account/sessions points at /settings/devices, which exists from step 15.

## D-030: The PIN is a screen lock, not encryption (step 13f, O-15)
The PIN lock keeps a person out of the app on a device someone else is holding. It does **not** encrypt the notes: anyone with the device unlocked and DevTools can still read IndexedDB, and four digits can be tried quickly by code on the device. Do not describe it to users as encryption. Only a salted PBKDF2 hash (SHA-256, random salt, 100,000 rounds) is stored, in `meta`; the digits are never stored. The PIN belongs to the device, not the account, so the app opens offline. The wrong-PIN count is kept in `meta` too, so closing the app does not give the five tries back. Five wrong PINs refuse even the right one until the person signs in again, which turns the lock off. The lock shows when the app opens and when the person returns from the background after `PIN_LOCK_DELAY_MS`. Normal sign-out and a failed start-up leave the PIN in place. Change password is built behind `FEATURES.passwordChange` (default off) and waits for B-02 in step 17.

## D-031: Legal text is a draft until a lawyer signs it off (step 13h, O-18)
Terms of use and Privacy are adapted from Ahorra's text for BuildingWithEze (BWE) and live in `src/pages/Settings/legalContent.ts`. They are drafts. **Release checklist (step 20): a lawyer reviews both texts, and every [bracketed item] (support email, release date, transcription provider) is replaced, before release.** The screens open as inner screens, not sheets (C-9). Version comes from `package.json` through `__APP_VERSION__`. Check for updates asks the service worker to look for a new version and shows the existing Reload banner when one is waiting.

## D-032: Collaboration runs on a Java relay inside the existing server (step 15a, B-07)
**Chosen: option B.** The Spring Boot server gets a WebSocket endpoint that stores and forwards opaque Yjs update bytes. The server never reads or merges Yjs. Option A (a Node Hocuspocus sidecar) is rejected for now.

**Why B.** One deploy unit instead of two, so no second cold start on Render and no second language to run. It reuses what already exists: the JWT from the internal auth service, the owner and share permission code, Redis (already a dependency) for one-time tickets, and Spring Modulith events for revoke and role changes. The cost is that we write the small protocol and the compaction rule ourselves (15d, 15e).

**What this commits us to.**
- **Auth.** Browsers cannot set an Authorization header on a WebSocket, so the client first calls `POST /api/v1/notes/{noteId}/collab-ticket` with its normal JWT and receives a single-use ticket (60 seconds, kept in Redis, bound to user, note and role). The socket is opened with `?ticket=` and the ticket is deleted on use (15c).
- **Storage.** `note_updates` (ordered by a per-note `seq`) and `note_snapshots` (state, `up_to_seq`, `plain_text`) in Flyway V5. A note becomes `COLLAB` when its first update arrives (15b).
- **Plain text comes from clients.** The server cannot read Yjs, so `plain_text` (used by search, notifications and sync for COLLAB notes) is whatever the last client SNAPSHOT supplied. Clients send a snapshot after a batch of updates and when a note is closed; the server deletes updates up to `upToSeq` when it stores one. A note nobody has snapshotted yet can have stale plain text. This is accepted.
- **Permissions on every frame.** A Viewer's UPDATE is rejected and not stored. Revoke closes the user's sockets with code 4403, and a role change sends a ROLE frame without reconnecting (15e).
- **Legacy writes blocked.** `PUT` and `PATCH /notes/{id}` that send content return 409 `BODY_IS_COLLABORATIVE` for a COLLAB note (15f).
- **One server instance for now.** Broadcast is in memory, so two server instances would need a Redis pub/sub fan-out before scaling out. The scheduled purge job has the same single-node limit (B-21). Revisit both before running more than one instance.
- **Idle connections.** Render closes idle sockets, so the server pings every 25 seconds and drops dead sessions.
- **Protocol document.** The protocol lives in one class (`CollabProtocol`) with a short `docs/collab-protocol.md`; the client in step 16 follows it exactly.

**Revisit if** the relay's compaction or awareness handling becomes a maintenance burden, or if we need more than one server instance. Hocuspocus then becomes worth the second deployment. Steps 15g (share-leak fixes, module test) and 15h (contract tests) are the same under either option.

## D-032: Step 14l cleanup: aliases gone, z-index scale switched, old sharing screens removed
`legacy-aliases.css` is deleted and the Stylelint ignore list is gone, so every stylesheet now passes the design rules. The z-index scale is now the new one (overlay 80, menu 90, toast 100, splash 120, per D-008); `--z-sticky: 10` was added to `tokens.css` for the pinned note header and date. The old global heading, link and code rules went with the aliases; the editor surface carries its own code font. The old `ShareNote`, `SharedNote` and `InviteCollaborator` screens, `CollaboratorPicker`, the shared-voice recorder and the old `Modal`, `Select`, `TextField`, `Button`, `Toast`, `Spinner` and `Field` components are deleted. **Sharing, opening a shared note and inviting collaborators do not work until step 15 rebuilds them.** The route builders `ROUTES.legacy.noteShare`, `sharedNote` and `collaborationsInvite` stay for now, so those four entry points land on Not found until then.
| Phone verification | Replaced by email verification. Register no longer asks for a phone number; the code is emailed through Mailjet. The server paths are now `/email/verify` and `/email/resend-verification`, and password reset asks for an email address. | CHANGED |

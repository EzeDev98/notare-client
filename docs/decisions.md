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
| O-10 | Accent vs logo violet (`#6D28D9`) | Keep `#6B5BB5` unless you want the brand to match the logo | OPEN | Step 2 |
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

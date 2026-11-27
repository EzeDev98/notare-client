# The adapter: what it fakes

All note-server talk goes through `gateway` from `src/core/adapter`. Today's only
implementation is `legacyGateway.ts`, which calls the server as it is. This list
is every behaviour the adapter fakes or papers over. Step 20 deletes the adapter
by deleting `legacyGateway.ts` and this file.

Only `legacyGateway.ts` may import `noteService` and `voiceService`. ESLint
enforces it (`@typescript-eslint/no-restricted-imports`
in `eslint.config.js`). Tests are exempt.

## Names

- A **clip** is the server's **voice note**. The gateway says `uploadClip`,
  `listClips`, `downloadClip`; `legacyGateway` maps them to `/voice-notes`.
- `deleteNote` is the server's soft delete (to Recently deleted). `purgeNote` is
  the permanent delete.

## Faked or papered over

| # | What the screens see | What the server really does | Removed by |
|---|---|---|---|
| 1 | A note has one id, made on the device (`clientId`, same as `localId` at creation). | The server makes its own numeric id. The local row holds both (`clientId` and `serverId`), written by the caller right after `createNote` returns. `createNote` sends `clientId` in the body; the server may ignore it. | 17b |
| 2 | Every change is saved. | `autoSaveNote` is a PATCH that overwrites the content. "PATCH requires version" is documented but ignored, so a stale device can overwrite a newer one. The returned `version` is adopted, never incremented locally. | step 20 |
| 3 | A note can hold what the person writes. | The server cuts notes at 20,000 characters. The gateway does not check; the editor limit is `NOTE_MAX_CHARS` (timings.ts). | step 20 |
| 4 | A note has a title. | The server's note has `content` only. The title is the first line, worked out on the device. | step 20 |
| 5 | Pin and archive. | Online only (POST to set, DELETE to clear). They are not in the sync queue (ADR-0006). | step 20 |
| 6 | Recently deleted keeps notes 30 days. | Nothing on the server purges trashed notes. `TRASH_DAYS` is not enforced server-side. | 17e |
| 7 | A clip belongs to a note. | A clip can only attach to a note that already has a server id. Uploads use XHR for progress. Downloads fetch the whole file as a blob (no ranged streaming until the service worker, step 11). | step 20 |
| 8 | Search. | The query parameter is `query`, not `q`, and is required. Pages are zero-based. | none |
| 9 | Errors. | Nothing is caught here. Every failure reaches the caller as an `ApiError`. | none |

## Types

The wire types still live in `features/*/types`. The gateway imports them as
types only. They move into the adapter when the server contract changes.

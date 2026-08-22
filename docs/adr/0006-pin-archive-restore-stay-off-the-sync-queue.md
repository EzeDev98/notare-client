# ADR-006: Pin, archive, and restore stay off the sync queue

**Status:** accepted (pre-8A)

## Decision

The Step 8 outbox carries `CREATE`, `UPDATE`, and `DELETE` only, exactly
matching the server's `SyncOperationType`. Pin, archive, and restore are not
added to it — on either side.

A dirty row caused only by pin/archive/restore is not pushed by the outbox.
It is retried by calling the SAME direct endpoint (`PATCH /notes/{id}/pin`,
etc.) the action already calls when online, triggered by reconnection — a
concern of 8F, not 8A.

## Context

7D–7F made pin, archive, and delete local-first: the Dexie write is the real
action, and a comment in `useNoteActions.ts` says a failed request "simply
stays dirty and Step 8's push finds it in listDirty()." That comment was
written against an assumed contract, not the actual one.

The server's `SyncOperationType` enum already excludes pin, archive, restore,
and permanent delete, with a stated reason: each is a deliberate, low-frequency
action, and every type added is another branch in the batch handler and
another conflict case. This is a decision already made, not a gap to patch.

Checked directly before deciding this: `SyncOperationRequest`, the DTO an
`UPDATE` operation actually carries, has fields for `content` and
`version` only. There is no field for `pinned` or `archived`. "Fold it into
UPDATE" is not a free option — it requires the same DTO change, on the same
server, as adding dedicated operation types would. Both routes reopen the
same closed decision; neither is a shortcut around it.

## Reasoning

Reopening a server decision that was made deliberately, with a stated reason,
to patch a client-side comment that assumed a contract without checking it —
is fixing the wrong side. The client's assumption was the error.

What pin/archive/restore actually need is narrower than "join the sync
queue." Each already fires its direct request immediately when online, and
already fails silently by design — the row's "Unsaved" badge is the honest
signal, not a toast (see `useNoteActions.ts`, `useTrash.ts`). The missing
piece is retry after a real disconnection, which is squarely 8F's stated job
("online/offline transitions, retry with backoff... give `useOnlineStatus`
its real job") — it was never going to be 8A's.

## Alternatives considered

- **Extend `SyncOperationType` with `PIN`/`ARCHIVE`/`RESTORE`.** Rejected:
  reopens a server decision made with a stated reason, for three of the four
  local-first actions (permanent delete still wouldn't fit — it has no
  "pending" state at all, per `useTrash.ts`'s `deleteForever`).
- **Fold into `UPDATE`.** Rejected once actually checked: `SyncOperationRequest`
  has no field to fold them into without changing the DTO — the same cost as
  the option above, not a lighter one.
- **Silently accept the gap as-is.** Rejected: a failed pin made while
  offline would never be retried, which is a real behaviour regression from
  what the current client comments claim happens. The gap needed a named
  destination (8F), not silence.

## Consequences

- `listDirty()` needs to distinguish "dirty from an unsent content
  change" (the outbox's concern) from "dirty only from an unsent
  pin/archive/restore" (8F's concern) before 8A's schema is finalized — a
  single `dirty: 0 | 1` bit cannot answer that question today. This is 8A's
  first design decision, not an afterthought.
- The three misleading comments this ADR corrects (`useNoteActions.ts`,
  `useTrash.ts`, `noteRepository.ts`) are updated in the same change as this
  ADR, so the code and the decision agree from the moment this lands.
- Permanent delete needs no entry here: it was already decided (`useTrash.ts`)
  to be server-first with no offline affordance at all, which this ADR does
  not change.

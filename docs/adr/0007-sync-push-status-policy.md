# ADR-007: Sync push (8C) — trigger, and the CONFLICT/NOT_FOUND/INVALID policy

**Status:** accepted (Step 8C)

## Decision

1. **Trigger.** `pushOutbox()` is called on mount of the authenticated shell
   (`AppLayout`) and again on every browser `online` event. No backoff, no
   polling, no cross-tab lock.
2. **APPLIED.** CREATE/UPDATE adopt `note.id`/`note.version` via
   `applyServerAck` (already existed); DELETE has no `note` on the wire, so a
   dedicated `applyDeleteAck` clears dirty/outbox without touching a version
   that was never sent.
3. **CONFLICT.** The outbox row is left in the outbox. The note is stamped
   `syncState: 'conflict'` with the server's note attached (new
   `NoteRow.conflictNote` field). Later runs skip rows belonging to a
   conflicted note rather than resending them.
4. **NOT_FOUND.** The outbox row is cleared and the local note is hard
   deleted.
5. **INVALID.** The outbox row is cleared (never retried); the note is
   stamped `syncState: 'invalid'`; content is left untouched.

## Context

The gap analysis flagged two questions as open before 8C could be written:
what triggers a push, and what CONFLICT/NOT_FOUND/INVALID actually do,
given that 8E (conflict UX) and 8F (scheduling, backoff, cross-tab lock) are
later, unbuilt steps.

## Reason

**Trigger.** The roadmap puts backoff and cross-tab locking in 8F by name.
Building either into 8C would mean scheduling policy leaking into the
engine that 8F is explicitly supposed to own, and would make 8C untestable
as a unit — a `run()` that also owns its own retry timing cannot be called
once and asserted on. Mount-and-`online`, no backoff, is the smallest
trigger that makes 8C exercise real network conditions.

**CONFLICT.** The architecture doc is explicit: "keep the local copy... move
it to a conflict store with the server's note attached, surface conflict
UI." The last part — surfacing UI — is 8E's job by name; a dedicated
"conflict store" (a separate table) was considered and rejected for now,
because `NoteRow` already carries a `syncState` union with a `'conflict'`
member that 7D/7F already wired the read side to respect (`applyLocalEdit`
already preserves `'conflict'` rather than downgrading it to `'pending'` on
a subsequent edit — that guard existed before this ADR and 8C's job was to
finally make it reachable). Adding a second table to hold the same fact
would be two sources of truth for one note's conflict state. The server's
note is attached directly to the row instead, as `conflictNote`, so 8E has
something to render without a second round trip — matching the reason the
server returns the full note on conflict in the first place.

The outbox row survives deliberately. Clearing it would mean the user's
local edit is no longer queued anywhere, and the operation was not applied
— that is data loss dressed as cleanup. It stays until 8E lets the user
choose keep-mine, take-theirs, or merge, at which point resolving the
conflict is exactly "produce a new local edit," which the existing
`applyLocalEdit`/enqueue path already handles.

**NOT_FOUND.** This one is settled explicitly in the architecture doc's
table — "drop the operation and evict the local note (deleted on another
device)" — not left open. The gap-analysis note that raised it as a
"product call" was written before that table was checked; it is not,
in fact, an open question at the client layer.

**INVALID.** "Do not retry" (architecture doc) means the outbox row cannot
survive — a row that is never re-sent is functionally not in the queue,
whether or not it is physically still in the table, and leaving it there
would only mislead a future reader of `outboxRepository.list()` into
thinking it is still pending. But "never silently discard the user's text"
(same doc) means the *note* must not be touched: `markInvalid` changes only
`syncState`. The user's words stay on the note, visible as Unsaved, exactly
as they were before the doomed push — recoverable by copying elsewhere or
by whatever a future client-bug-report flow does with an `'invalid'` row,
never lost.

**Excluding conflicted/invalid rows from later runs.** Neither status
would be *incorrect* to resend — `operationId` keeps a retry idempotent
either way — but both are guaranteed to produce the identical result on
every future trigger until something external changes them (a human
resolving the conflict in 8E; nothing, ever, for the same INVALID
operation). Sending them anyway on every reconnect would mean one bad
offline edit taxes every future sync run for no possible benefit.

## Alternatives considered

- **A separate `conflicts` table**, as the architecture doc's directory
  sketch (`repositories/conflictsRepo`) suggests. Rejected for now: with
  `syncState` and a `conflictNote` field, one row answers "is this note in
  conflict" and "what does the server's copy look like" without a second
  table that has to be kept in sync with the first. Revisit if 8E turns out
  to need multiple conflicts open per note at once, which the one-row-per-note
  design cannot express.
- **Retry INVALID with the batch anyway, relying on the server to reject it
  identically.** Rejected: it is not wrong, but it is a wasted request on
  every single trigger, forever, for a result that cannot change — worse
  than the small bookkeeping cost of excluding it here.
- **Evict the note silently on INVALID, same as NOT_FOUND.** Rejected
  outright by the architecture doc's own wording ("never silently discard
  the user's text") — NOT_FOUND and INVALID look similar (both terminal,
  both stop retrying) but mean opposite things about whether the user's
  content still matters.

## Consequences

- `NoteRow` gained a `conflictNote: NoteResponse | null` field. Every
  constructor of a fresh row (`createLocalNote`, `fromNoteResponse`,
  `fromNoteSummary`) sets or preserves it explicitly; `applyServerAck` clears
  it on any successful ack, on the same reasoning as `fromNoteResponse`.
- There is still no conflict UI. A conflicted note is currently only
  visible as `syncState === 'conflict'` plus a populated `conflictNote` —
  useful to a future 8E screen, invisible to the user today. That gap is
  8E's, not a defect in this ADR's scope.
- `useSyncPush` lives in `AppLayout`, not `AuthProvider`. If a future screen
  needs to trigger a push outside the authenticated shell, revisit that
  placement rather than duplicating the effect.

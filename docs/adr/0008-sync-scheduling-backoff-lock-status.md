# ADR-008: Sync scheduling (8F) — triggers, backoff, cross-tab lock, status

**Status:** accepted (Step 8F)

## Decision

1. **Triggers.** `engine.start(ownerId)` runs a sync on mount, on the
   browser's `online` event, when the tab becomes visible, on a debounced
   (2s) local mutation, and on a 60s interval — the interval only exists
   while the tab is visible, and is torn down (not paused) the instant it
   isn't.
2. **Cross-tab lock.** `navigator.locks.request('notare.sync', { ifAvailable:
   true }, …)`, same mechanism as `notare.auth.refresh` (4D). Unlike the auth
   lock, a run that loses the race **skips** rather than waiting.
3. **Backoff.** 5s → 15s → 30s → 60s, resetting to the first step on any
   clean run, engaging only after a genuine transport failure — never after
   the routine "nothing was queued" no-op.
4. **Status.** A framework-free store (`idle | syncing | offline | error`)
   with `lastSyncedAt`/`lastError`, read into React via
   `useSyncExternalStore`. Surfaced in the UI only for the three non-resting
   states — `idle` renders nothing.

## Context

8C (push) and 8D (pull) both deliberately left scheduling to this step —
each says so explicitly in its own doc comments. The architecture doc names
the shape this step should take: "a single subsystem with one public
surface... and no knowledge of React," triggers listed by name, and the
lock/backoff/status-surface bundle as one unit.

## Reason

**Why these five triggers and not fewer.** `online` and mount are what 8C/8D
already had — necessary but not sufficient, because a browser can report
`navigator.onLine: true` while every request still fails (a captive portal,
a flaky connection, a VPN mid-reconnect — `useOnlineStatus.ts`'s own doc
comment already says as much: it can tell you offline reliably, not online).
The 60s interval exists specifically for that gap — a steady heartbeat that
does not depend on the browser correctly noticing a state change. Visibility
and the debounced mutation are the two the architecture doc adds beyond
"the obvious ones": visibility because a tab someone just tabbed back into
is exactly when staleness is most visible to them, and mutation because a
user who just wrote something offline is the person with the most reason to
want that write to leave the device soon, not sixty seconds from now.

**Why the interval is destroyed, not paused, on hidden.** Named directly in
the architecture doc's Risks table and again in §3.8: "never a bare
`setInterval` that fires in a background tab forever." A background tab
that keeps syncing every 60s is wasted battery and wasted requests for a
screen nobody is looking at, multiplied by however many tabs someone leaves
open. `stopInterval()`/`startInterval()` are the whole mechanism —
`clearInterval` on `hidden`, a fresh `setInterval` on `visible` — deliberately
NOT a pause/resume that remembers elapsed time, since that saved state would
be one more thing that could drift from reality across a long-hidden tab.

**Why the cross-tab lock skips rather than waits.** `notare.auth.refresh`
(4D) genuinely needs FIFO ordering — every tab needs a token, so a tab that
loses the race must wait for its turn. A sync run has no equivalent need:
if tab B tries to sync while tab A already holds the lock, tab A is doing
the EXACT same push-then-pull tab B would have done. There is nothing for B
to wait for and then redo — A's run already covers B's reason for running.
`{ ifAvailable: true }` makes this the whole difference from 4D's lock: one
extra option on an otherwise identical `navigator.locks.request` call.

**Why backoff is keyed off `transportFailure.ts`'s flag and not
`pushOutbox`/`pullChanges`'s return value.** Both already return
`Promise<void>` and already swallow a transport failure rather than
rejecting — the correct behaviour for 8C/8D's own job, independent of
whether anything is scheduling them. Changing that return shape now to add
a signal 8F needs would ripple into every existing caller, including
`conflicts.ts`'s direct, unscheduled `pushOutbox()` call after a conflict
resolution — a caller that has no interest in backoff and shouldn't have to
change to accommodate it. A one-bit flag in its own leaf file, set in the
same breath the error is swallowed and read once per attempt, gets the
engine what it needs without moving that decision onto every other caller.

**Why backoff is capped at the steady-state interval and not smaller.** A
backoff step longer than the normal 60s interval would mean a persistent
failure is retried MORE slowly than an app that never had trouble at all —
worse behaviour under a real problem than under none. Capping at the
interval's own value means the worst case a user experiences is "sync
behaves like it always does," never "sync got quietly slower."

**Why `error` is a distinct status from `offline`, and both still get
backoff.** `offline` means "we tried to reach the server and couldn't" —
expected, recoverable by nothing but time or reconnecting, and not the
user's problem. `error` means the batch endpoint returned something
`push.ts`/`pull.ts` don't recognise, or threw for a reason that isn't
`isOffline` — a client bug or a server contract change, and arguably
something worth a bug report. Collapsing the two into one status would hide
that distinction from anyone debugging a report; keeping them separate
costs one more union member and one `console.error` call. Backoff still
applies to `error`, not just `offline`: the alternative — stop retrying
entirely — leaves a transient issue permanently unrecovered until the next
unrelated trigger (a mutation, a visibility change) happens to fire.

**Why the status surface hides `idle`.** Same rule `SaveIndicator.tsx`
already states outright and the conflict banner already follows: showing
"Synced" permanently on every screen is chrome competing with content for a
fact nobody asked about. The three states worth a line of text are the ones
where something is different from normal — mid-run, unreachable, or broken.

## Alternatives considered

- **Exponential backoff with jitter**, the textbook version. Rejected for
  now: jitter exists to prevent a thundering herd of independent clients
  retrying in lockstep against a shared server, which matters at a scale
  this app is nowhere near, and a fixed schedule is easier to write a
  deterministic test against (`engine.test.ts` asserts exact millisecond
  boundaries). Revisit if `/sync` ever needs the protection.
- **Reading `pushOutbox`/`pullChanges`'s resolved value instead of a
  separate transport-failure flag**, by changing them to return a status
  enum. Rejected — see Reason above; the blast radius across existing
  callers outweighs the mild indirection of a flag module.
- **Pausing the interval on hidden with `clearInterval` alone, no separate
  visibility-triggered run on return.** Rejected: without the extra run on
  `visible`, a tab hidden for anywhere up to just under 60s would return to
  a stale view with no sync happening until the NEXT natural trigger,
  silently reintroducing exactly the staleness visibility-as-a-trigger
  exists to close.

## Consequences

- `push.ts` and `pull.ts` each gained one `markTransportFailure()` call in
  their existing `catch` block, immediately before the early `return` they
  already had. No other change to either file, and no existing test for
  either needed to change.
- `outboxRepository`'s three `enqueue*` methods changed from `return
  db.transaction(...)` to `await db.transaction(...); notifyLocalMutation();`
  — the notification fires only after the write has actually committed, and
  outside the transaction so a synchronous listener cannot extend it.
- `useSync.ts` shrank from owning trigger logic to a five-line wrapper
  around `engine.start`. Its exported name and signature are unchanged, so
  `AppLayout.tsx` needed no change to keep calling it — only a new,
  additive `useSyncStatus()` call for the status line.
- `engine.test.ts` mocks `push.ts`/`pull.ts` rather than exercising the real
  Dexie/MSW stack. Combining fake timers with real IndexedDB and real MSW
  handlers inside one test file turned out to be a genuinely separate,
  flaky problem from anything this file needs to verify — push.test.ts and
  pull.test.ts already cover what those two functions actually do end to
  end; this file only needs to know the engine calls them, in what order,
  and reacts correctly to what they report back.

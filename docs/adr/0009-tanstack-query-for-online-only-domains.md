# ADR-009: TanStack Query, scoped to online-only domains only

**Status:** accepted (9A)

## Decision

TanStack Query is introduced in 9A, and used for exactly the domains that
have no local copy to reconcile against: sharing (`sharedNoteService`),
and — as they land in 9C/9D — collaboration and notifications.

**Notes stay out of it.** Dexie remains the notes domain's source of truth,
read live via `useLiveQuery`, written to directly by the editor and the sync
engine. This was flagged as the single biggest open decision in
`NOTARE-CLIENT-ARCHITECTURE.md` (D1) and is settled here, explicitly, rather
than by default.

## Context

`useSessions.ts` has carried this comment since before 9A began:

> A HAND-ROLLED fetch hook... no cache, no deduplication, no background
> refetch, no retry, and the loading/error state written out by hand. Every
> screen that fetches will want the same things and will get a slightly
> different version of them. That is the argument for TanStack Query, which
> arrives in 9A for exactly the online-only domains this belongs to.

Shared notes are the first of those domains to actually get built, so 9A is
where the library is introduced rather than assumed.

## Reasoning

Two mechanisms already exist for two different truths:

- **Dexie + `useLiveQuery`** for notes: the local database *is* the store,
  and the sync engine's entire job is moving data between it and the server.
  Layering a query cache on top would create two caches that can disagree,
  and every write would need to be mirrored into both to keep them from
  drifting — exactly the two-writer problem `updateAuthorizedNote` on the
  server was built to avoid, reintroduced client-side for no reason.
- **TanStack Query** for domains where the server genuinely is the only
  copy: shared notes have no offline draft (there is no auto-save endpoint
  for a collaborator to write to — see `UpdateSharedNoteRequest`'s doc
  comment), so there is nothing local for a cache to disagree with. This is
  precisely the model TanStack Query assumes: "the server is the truth, this
  is a cache."

Introducing a second state-management mechanism is a real cost — a second
set of idioms, a second thing to debug, a second answer to "where does this
data live?" That cost is worth paying here because the alternative,
hand-rolling `useSessions.ts`'s pattern for every online-only screen, is the
same fetch/loading/error/cancellation boilerplate rewritten with a subtly
different bug each time. It is not worth paying for notes, where a
perfectly-working mechanism already exists and the two models actively
conflict rather than complementing each other.

## Alternatives considered

- **One uniform mechanism for all server state**, TanStack Query included,
  with notes migrated onto it and Dexie relegated to an offline queue behind
  it. Simpler to explain in one sentence. Rejected: this is the
  architecture doc's own D1 alternative, and its stated cost is accepted
  here as still correct — "expensive to reverse" once sync (Step 8) is
  built on Dexie being authoritative, which it now is.
- **Keep hand-rolling fetch hooks** for sharing, collaboration, and
  notifications rather than adding a dependency. Rejected on the same
  reasoning `useSessions.ts` already gives: three-plus screens are about to
  want the same cache/loading/error/retry behaviour, and a dependency that
  earns its place by removing hand-written bugs is a good trade the moment
  more than one caller needs it (`shared/` folder's own two-callers rule,
  `docs/architecture/structure.md`).
- **Migrate `useSessions.ts` onto TanStack Query in the same change.**
  Rejected as scope creep for 9A, which the gap analysis scopes to
  `sharedNoteService` specifically. `useSessions.ts`'s own comment already
  names it as a future candidate; doing it opportunistically here would mean
  reviewing an unrelated screen's behaviour changes inside a PR titled
  "shared notes."

## Consequences

- `QueryProvider` sits inside `AuthProvider` in `App.tsx`: every query this
  client will ever run is scoped to a signed-in user, so the cache should
  not exist where a session doesn't. Nothing currently clears the cache on
  logout — a real gap, worth closing before 9C adds collaboration state
  that a second user on the same device must not see. Tracked as follow-up
  work, not silently deferred.
- `retry: false` at the client level, not per-query: these domains have no
  offline affordance, so a failed request should reach an error state
  immediately rather than retry into a UI that looks like it's still
  loading during a real outage. `useSharedNote` restates it explicitly
  anyway, because "no grant" (404) is a case where retrying is not just
  unhelpful but wrong regardless of what the client-wide default happens to
  be — the reader should not have to check `QueryProvider` to know that.
- `useSessions.ts` is not touched by this ADR. It remains hand-rolled until
  its own migration is scheduled.

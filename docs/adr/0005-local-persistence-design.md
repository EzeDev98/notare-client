# ADR-005: Local persistence — Dexie, a separate database, and the schema v1 index design

**Status:** accepted (Steps 7A–7C)

## Decision

1. Local notes live in their own Dexie database (`features/notes/local/database.ts`),
   separate from the auth store.
2. Dexie, not raw IndexedDB.
3. Schema v1 indexes exactly: `localId, &serverId, clientId, [ownerId+deleted+archived], dirty, syncState, localUpdatedAt, updatedAt` — no more, no less — and every `version()` block stays in the file permanently, including once superseded.

## Context

These three decisions were made while building Steps 7A–7C and were recorded
only as comments inside `database.ts`. That satisfies a reader of the file;
it does not satisfy brief §48, which asks for decision/reason/alternatives/
trade-offs to survive a refactor. A comment block is deleted the moment
someone rewrites the function it explains.

## Reason

**Separate database.** Clearing cached notes must not sign a user out, and
signing out must not discard unsynced drafts. Two databases make that
structural — there is no code path that touches both — rather than a
behaviour that depends on remembering not to call the wrong `clear()`.

**Dexie over raw IndexedDB.** The need is specific to this store: versioned
schemas with upgrade functions, promise-based transactions that survive
`await`, compound indexes, and `useLiveQuery` for the read path Step 7C
depends on. The auth store has one key and none of those needs, which is why
it was deliberately left on raw IndexedDB — the dependency is justified where
it is used, not adopted globally.

**The index list.** IndexedDB indexes are declared, not automatic — a schema
string lists which fields can be queried; everything else costs a full scan.
`[ownerId+deleted+archived]` is a compound index whose *order* is the design:
it directly serves the main list query (mine, not deleted, not archived) and,
because compound indexes serve their own prefixes, also serves `[ownerId]`
and `[ownerId+deleted]` for free — but not `[deleted]` alone, which was judged
not worth a dedicated index. `dirty` is indexed ahead of Step 8's push needing
`listDirty()`, and is a number rather than a boolean because IndexedDB cannot
index booleans — `where('dirty').equals(true)` matches nothing, silently,
which is a failure mode worth naming here so it is never rediscovered.

**`outbox` deliberately absent from v1.** Step 8 introduces it as a v2
migration, exercised against real local data that already exists, rather than
against an empty table.

## Alternatives considered

- **A generic `lib/db` for the database class.** Rejected: the class's own
  table types are note-shaped, and `lib/` must be explainable without saying
  the word "note" (`structure.md`). The database lives with the feature it
  serves.
- **Booleans for `deleted`/`archived`/`dirty` in the schema.** Rejected for
  `dirty` for the reason above; `deleted`/`archived` are part of the compound
  index rather than queried alone, so the same failure mode does not apply to
  them the same way, but the number convention was kept consistent across all
  three for one fewer thing to remember.

## Consequences

- Any new query pattern against `notes` should be checked against the
  compound index's prefix rule before assuming it is cheap.
- The `version()` history in `database.ts` is append-only. A future contributor
  deleting an old version block on the assumption "nobody's on v1 anymore" is
  the exact mistake this ADR exists to prevent.

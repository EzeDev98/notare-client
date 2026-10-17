# ADR-0013: The temporary server adapter was removed

**Status:** accepted (step 20a)

## Decision

Step 7f put every note-server call behind `gateway` (`src/core/adapter`), so screens could be built while the
server contract was still moving. Once the server did for real what the adapter faked, the adapter was deleted
(`legacyGateway.ts`, the `NoteGateway` interface and `docs/adapter.md`). A thin module, `src/core/api`, remains for
the few calls the app still makes online. ESLint allows only that module to import the note, voice and shared-note
services.

What the server now does for real: a client-made id on create (17a), version checks on writes (17a), clips as
children of a note (17b), a configurable note length cap (17j), a purge date for trashed notes (17e).

## Context

The adapter listed ten behaviours it faked. Nine were either done on the server or only described how things
work. Pin and archive stay online-only calls by decision (ADR-0006): the server's sync batch has no operation
for them, and adding one was judged not worth it for release 1.

## Consequences

- Only nine calls remain in `src/core/api`: delete, restore and purge a note; pin and archive; upload and download
  a clip; list shared notes; leave a note.
- Old route redirects stay for one release after the data migration (server docs/migration.md, section 18g).

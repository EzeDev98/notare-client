# ADR-0010: The note body is a Yjs document saved on the device

**Status:** accepted (step 20c; built in steps 12 and 18d)

## Decision

A note's body is a Y.Doc with one XML fragment. It is saved as `bodyState`, an encoded Yjs update, on the
note's row in Dexie. `content` (plain text, one line per block, list markers kept) is derived from the same
document in the same write, and is what the list, search and the server's plain-text fields read. The editor
reads `bodyState`.

- **Opening never rewrites text.** An old note with text and no `bodyState` is converted once, when the person
  opens it, and the result is saved without marking the note as edited.
- **Deterministic seed (18d).** The conversion builds a fresh Y.Doc with a fixed client id (1), in one
  transaction, from server-confirmed text, with an origin that names the converter version (`seed:v1`). Two
  devices that convert the same note get identical bytes, so merging them does not duplicate text. The converter
  version is stored on the row (`bodySeedVersion`); a note that already has a body is never converted again.
- **No seed from unconfirmed text.** A synced note with unsynced edits is shown from its local text but not
  saved as a seed. It is rebuilt once it has synced.
- **Compaction.** The saved state is folded into one clean update every 100 writes.
- **Server text wins on conflict.** If the server's text replaced ours, the saved body is dropped and rebuilt
  from that text the next time the note opens.

## Context

Live editing between devices needs a shared document model, and offline editing needs the document on the
device. Markdown text alone cannot merge two offline edits without overwriting one.

## Consequences

- Plain text stays available everywhere that does not need the document (list, search, sync of `content`).
- Changing the converter means bumping `SEED_CONVERTER_VERSION`; already-seeded notes are unaffected.
- The server never reads Yjs. Plain text for collaborative notes comes from client snapshots (see ADR-0011).

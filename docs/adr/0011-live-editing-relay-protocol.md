# ADR-0011: Live editing goes through a relay inside the Notare server

**Status:** accepted (step 20c; server side recorded as D-032 in the server repo's docs/decisions.md)

## Decision

The Spring Boot server runs a WebSocket relay that stores and forwards opaque Yjs updates. It never reads or
merges Yjs. The protocol is defined in one class on the server (`CollabProtocol`) and described in the server
repo's `docs/collab-protocol.md`; the client follows it exactly (`src/features/collab/collabProtocol.ts`).

- **Auth.** A browser cannot set an Authorization header on a WebSocket. The client calls
  `POST /notes/{noteId}/collab-ticket` with its normal token and gets a single-use ticket (60 seconds, bound to
  user, note and role), then opens the socket with `?ticket=`.
- **Permissions on every frame.** A Viewer's update is rejected and not stored. Revoking access closes the
  person's sockets (code 4403); a role change arrives as a ROLE frame without reconnecting.
- **Plain text comes from the client.** The server cannot read Yjs, so the client sends a snapshot (with
  `plain_text`) after a batch of updates and when a note is closed.
- **Origin.** Changes that came from the server carry the origin `remote`; any other origin is a local change
  and is queued for sending (`UpdateQueue`).
- **Keep-alive.** The server pings every 25 seconds so the host does not close idle sockets.

## Context

The editor needs live merging between devices and offline queuing of edits. Running a separate Node relay was
rejected for now: one deploy unit, one language, and it reuses the existing auth, share and Redis code.

## Consequences

- One server instance for now: broadcast is in memory. More than one instance needs a Redis fan-out first.
- A note nobody has snapshotted yet can have stale plain text.

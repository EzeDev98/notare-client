# Notare

A local-first notes client. Read from IndexedDB, write through to the server,
work with no connection at all.

## Stack

TypeScript 6 · React 19 · React Router 8 · Vite 8 · Vitest 4 · MSW 2 · Dexie

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check, then build |
| `npm run typecheck` | Type-check only |
| `npm run lint` / `lint:fix` | ESLint, including the layer-boundary rules (see ADR-002) |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:watch` | Vitest |

## Where things live

Full reasoning in `NOTARE-CLIENT-ARCHITECTURE.md`. Short version, and the two
rules that actually matter, are in `docs/architecture/structure.md`.

## Decisions

`docs/adr/` — one file per decision that would otherwise only live in a code
comment or a person's memory. If you make a call that the next person could
reasonably reverse without knowing why it was made, it goes here.

## Current status

Tracked in `NOTARE-CLIENT-GAP-ANALYSIS.md`. Short version: Steps 1–7 are
complete; Step 8 (sync engine) has not started.

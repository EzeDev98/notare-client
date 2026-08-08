# Project structure

Enforced by `eslint.config.js`. Full reasoning in NOTARE-CLIENT-ARCHITECTURE.md §3.

## Layers, top to bottom

| Directory | Holds | May import |
|---|---|---|
| `app/` | composition root: App, router, providers, startup | anything |
| `pages/` | one folder per screen — `Xxx.tsx` + `Xxx.css` | features (hooks + components), design-system, shared |
| `features/<domain>/` | `api/` `hooks/` `components/` `types.ts` | lib, shared, design-system, other features' public hooks |
| `sync/` | the offline engine: pull, push, reconcile, conflicts | lib, feature api, shared |
| `design-system/` | tokens + primitives, each `.tsx` + `.css` | shared only |
| `lib/` | http, db, config, logger, time — infrastructure | shared only |
| `shared/` | genuinely cross-cutting hooks, utils, types | nothing internal |
| `pwa/` | service worker, registration, update prompt | lib, shared |

## The two rules that matter

**Components go through hooks.** A page or component never imports
`lib/http`, `lib/db`, a feature's `api/`, or the sync engine. Data-fetching
policy lives in hooks; a component that fetches cannot be tested without
mocking the network.

**Infrastructure never imports the application.** `lib/` and
`design-system/` must work in a project that has never heard of notes.

## Where a fact goes

- A fact about ONE domain lives in that feature. Note logic in `features/notes`,
  not in `shared/`.
- `shared/` is for things genuinely used by three or more features. Two is a
  coincidence; move it on the third.
- A file in `lib/` should be explainable without saying the word "note".

## Empty directories

Layer folders were created ahead of their contents, with `.gitkeep`. Any that
is still empty by Step 4 should be deleted rather than defended.

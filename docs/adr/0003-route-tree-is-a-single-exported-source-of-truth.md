# ADR-003: The route tree is one exported array, tested as a whole

**Status:** accepted (Step 7D)

## Decision

`router.tsx` exports `routes` (the plain data array), not just the `router`
built from it. `router.test.tsx` imports that array, mounts it in a
`createMemoryRouter`, and navigates to every authenticated path, asserting on
`document.title` that the intended page rendered rather than falling through
to `NotFound`.

## Context

Four pages — `NewNote`, `Trash`, `Search`, and `Notes` with `archived` — were
built and fully tested between Steps 5 and 7, and were unreachable in the
running app the entire time. `NoteTabs` linked to `/archived` and `/trash` on
every screen; both rendered the 404 page. `/notes/new` was silently captured
by `/notes/:noteId` with `noteId` bound to the literal string `"new"`.

## Reason

Every one of those pages had its own test, and every one passed. Each test
built a throwaway `createMemoryRouter([{ path: '/x', element: <X /> }])` —
proof the component renders, not proof the app can reach it. Nothing in the
suite ever asked "does `router.tsx` actually contain a route for this path?",
so a page could be finished, tested, reviewed, and merged, and still be dead
code.

A route tree is configuration, and configuration bugs are invisible to unit
tests that supply their own configuration. The only test that catches
"forgot to register the route" is one that imports the real route data.

## Alternatives considered

- **A checklist / PR template item ("did you add the route?").** Rejected for
  the same reason ADR-002 rejected convention-and-review for layer boundaries:
  works until the first busy week, and the busy week is precisely when this
  class of bug ships.
- **Testing through `App.tsx` / `createBrowserRouter` directly.** Rejected:
  `createBrowserRouter` needs a real `window.history` and is awkward to
  parameterise over multiple starting paths in one suite. `createMemoryRouter`
  over the same `routes` array gives identical route-matching behaviour with
  neither cost.

## Consequences

- Any future page must be added to `routes` and to `AUTHENTICATED_PATHS` in
  `router.test.tsx` (or an equivalent path list) or the test suite does not
  know it exists — which is the honest state of affairs, not a gap.
- `router.test.tsx` is the one place allowed to import `routes` for this
  purpose; page-level tests should keep building their own minimal router,
  since they are testing the page, not the tree.

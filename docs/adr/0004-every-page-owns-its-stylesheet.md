# ADR-004: A page never reaches into another page's CSS

**Status:** accepted (Step 7H)

## Decision

Every folder under `pages/` contains exactly one `Xxx.tsx` and one `Xxx.css`
(already stated in `docs/architecture/structure.md`). A page may share a
*visual language* with another page, but does so by having its own stylesheet
declare the same tokens under its own class names — never by rendering with
another page's class name and relying on that page's CSS having been loaded
by something else.

## Context

`NewNotePage` rendered `<article className="note-detail">`, reusing class
names owned by `NoteDetail.css`, without importing any stylesheet of its own.
It never crashed and no test caught it, because most of the suite reaches
`NewNotePage` only after visiting `NoteDetail` first, which had already
triggered that CSS import as a side effect.

## Reason

Routes are lazy-loaded, and so is the CSS a route's chunk imports. The one
path a real user takes to a new note — clicking "New note" straight from
`/notes`, or hitting `/notes/new` as a first action — never loads
`NoteDetail`'s chunk at all. The page was unstyled for exactly the user who
had never opened an existing note, which a suite that always visits
`NoteDetail` first cannot see.

Borrowing a class name is a hidden dependency on *load order*, not a styling
decision — and Vite's code-splitting makes load order something the router
decides, not something a component can assume.

## Alternatives considered

- **Import `NoteDetail.css` from `NewNote.tsx` and keep `.note-detail`.**
  Rejected: it repairs the symptom while keeping the real problem, which is
  one page's markup depending on another page's file. The next rename of
  `.note-detail` silently breaks `NewNote` again.
- **A shared `.reading-page` class in `design-system/`.** Reasonable in
  principle, but two call sites is not yet the pattern (`shared/` rule,
  `structure.md`: two is a coincidence, move it on the third). Revisit if a
  third page wants the same layout.

## Consequences

- `NewNote.css` now defines `.new-note` / `.new-note__centre` independently.
  The declarations are currently identical to `NoteDetail.css`'s equivalents;
  that duplication is accepted for now per the alternative above.
- A lint rule that flags a `.tsx` file with no sibling `.css` import would
  catch this mechanically rather than by review; not implemented here, noted
  as a candidate the next time `eslint.config.js` is touched.

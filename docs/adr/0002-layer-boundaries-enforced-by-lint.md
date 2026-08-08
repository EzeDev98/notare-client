# ADR-002: Enforce layer boundaries with ESLint

**Status:** accepted (Step 1C)

## Decision

Express the dependency direction between layers as `no-restricted-imports`
rules in `eslint.config.js`, scoped per directory.

## Context

The architecture defines a strict layering — components go through hooks, and
infrastructure never imports the application. TypeScript has no cross-module
visibility modifiers: every export is reachable from everywhere, and a deep
relative path crosses any boundary invisibly.

## Reason

A boundary is cheap to hold and expensive to restore. The first component that
imports `httpClient` directly works fine; so does the tenth. By the fiftieth the
layer has stopped meaning anything and restoring it means touching fifty files.
The linter is the only enforcement mechanism available, which makes this
architecture rather than style.

## Alternatives considered

- **Convention and code review.** Rejected: works until the first busy week.
- **`eslint-plugin-boundaries`.** More expressive — it can express "feature A
  may not import feature B's internals", which the core rule cannot. Rejected
  for now as a dependency not yet earned. Revisit if cross-feature coupling
  becomes a real problem.

## Consequences

- Cross-feature isolation stays a review concern.
- Deep relative imports (`../../`) are banned outright, since they hide which
  layer they cross.

# ADR-001: Stay on TypeScript 6 for now

**Status:** accepted (Step 1A)

## Decision

Pin TypeScript to `~6.0.x` rather than adopting TypeScript 7.

## Context

TypeScript 7 — the native Go compiler — is stable and dramatically faster.
`create-vite` independently chose 6.0.x for the scaffold, which is a signal in
itself.

## Reason

The linting set up in 1F is TYPE-AWARE: `typescript-eslint` resolves the
TypeScript program to run `no-floating-promises`, which is the rule most likely
to catch a real bug in this codebase. typescript-eslint's support for TS 7's
new compiler API is still landing. Adopting TS 7 now risks a linter that cannot
talk to the compiler, which would cost us the rule the whole type-aware setup
exists for.

## Alternatives considered

- **Adopt TS 7 immediately.** Faster builds. Rejected: the speed is not a
  bottleneck at this size, and the tooling risk is real.
- **Adopt TS 7 without type-aware linting.** Rejected: that trades a real bug
  class for build speed we do not need.

## Consequences

- TS 7 deprecations surface one at a time rather than all at once. Already seen:
  `baseUrl` is deprecated in 6 and removed in 7, so `paths` is now declared
  relative to the tsconfig instead.
- Revisit at Step 11, or sooner if typescript-eslint ships TS 7 support.

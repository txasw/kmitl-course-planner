# 11. Package manager: pnpm

Status: Accepted
Date: 2026-07-07

## Context

Continuous integration requires deterministic installs, and the project pins
exact dependency versions to keep builds reproducible across machines.

## Decision

Use pnpm with a committed lockfile and the package manager version recorded in
package.json. Continuous integration installs with a frozen lockfile.

## Alternatives considered

npm and Yarn are viable, but pnpm has a strict node modules layout that surfaces
undeclared dependencies and a fast, space efficient store.

## Consequences

The strict layout means dependencies must be declared explicitly rather than
relying on hoisting. The lockfile is the source of truth for installs in CI.

# 10. Icons: lucide-react

Status: Accepted
Date: 2026-07-07

## Context

The interface needs a consistent icon set for affordances. Project policy forbids
emoji anywhere, so visual affordances must come from icon components.

## Decision

Use lucide-react. It provides a consistent stroke icon set as React components,
which suits the React runtime and satisfies the no emoji policy.

## Alternatives considered

Emoji are prohibited by policy. Icon fonts pull remote assets or large payloads
and are harder to tree shake than per icon components.

## Consequences

Icons are imported per component and tree shaken, keeping the bundle small.
Visual affordances stay consistent across the interface.

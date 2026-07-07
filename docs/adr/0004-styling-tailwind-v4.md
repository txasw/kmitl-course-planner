# 4. Styling: Tailwind CSS v4

Status: Accepted
Date: 2026-07-07

## Context

The interface needs a dense, consistent visual system that compiles into the
shadow root stylesheet with no leakage in either direction, plus design tokens
expressed as CSS custom properties.

## Decision

Use Tailwind CSS v4 through its Vite plugin, with design tokens declared in an
at-theme block and on the shadow host. Tailwind v4 emits its theme variables
under a selector that includes the shadow host, and it registers its internal
properties with a universal fallback, so utilities resolve inside the closed
shadow root without a custom transform. Spacing is pinned to pixels so layout
does not rescale with the host page root font size.

## Alternatives considered

Tailwind v3 would require a JavaScript config and a manual step to scope theme
variables to the shadow host. Plain CSS modules would lose the utility workflow
and the token to utility mapping.

## Consequences

The compiled stylesheet is injected only into the shadow root. Token behavior in
the shadow tree depends on Tailwind v4 continuing to scope variables to the host,
which is verified when the dependency is upgraded.

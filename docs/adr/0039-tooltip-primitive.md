# 39. Accessible tooltip primitive

Status: Accepted
Date: 2026-07-13

Extends ADR-0020.

## Context

The panel used the native HTML `title` attribute for hover hints: the day row
labels, the truncated course and teacher names, the drag surface hint, and the
plan menu icon buttons. A native `title` does not meet WCAG 1.4.13 (content on
hover or focus): it is not dismissible with Escape, its content is not hoverable,
it appears and disappears on a browser timer the page cannot control, it cannot be
styled to match the panel, and it never shows for a touch or keyboard user in a way
the design can rely on. The panel needs one consistent, accessible tooltip.

## Decision

A shared `Tooltip` component in `src/components`, built on the already adopted
`@floating-ui/react` (ADR-0020) so it adds no dependency. It shows on pointer hover
after a short open delay and on keyboard focus, keeps its own content hoverable
through `safePolygon` so a pointer can travel onto it, and wires `role="tooltip"`
with `aria-describedby` on the trigger through `useRole`. It dismisses on Escape
through a capture phase document listener that stops propagation, so the Escape
reaches the tooltip but not the overlay focus trap that listens on the panel in the
bubble phase, keeping the panel open. It positions with the same fixed strategy,
flip, and shift as the other popups and portals into the shadow root overlay node
through `usePanelPortal`, falling back to an inline render when there is no portal
node. It appears without motion, so it has no reduced motion path.

The trigger is a render prop: the call site renders its own element, attaches the
reference through a JSX ref, and spreads the interaction props, so the tooltip
anchors to the exact element and the element keeps its own handlers and classes,
with no wrapper that would change layout.

## Alternatives considered

Keeping the native `title` was rejected because it fails WCAG 1.4.13 and cannot be
styled or made consistent. A third party tooltip library was rejected because
floating-ui already owns positioning in this project and a tooltip is a thin layer
over it. Cloning the child element to inject the ref and the interaction props was
rejected because passing a ref through a props object to `cloneElement` trips the
refs lint rule, which the project enforces with no disables; the render prop
attaches the ref through a JSX attribute instead. A wrapper element around the
trigger was rejected because a positioned wrapper changes layout for the truncating
catalog rows and the grid day cells, and a `display: contents` wrapper has no box
for floating-ui to measure.

## Consequences

One primitive replaces every native `title` in the panel, and new controls use it
rather than reintroducing `title`. It composes with the existing floating-ui,
shadow root portal, and focus infrastructure, so its behavior and positioning match
the combobox and the popovers. Because it stops Escape at the document in the
capture phase while open, a single Escape closes the tooltip and a second closes the
panel, which is the expected layered dismissal.

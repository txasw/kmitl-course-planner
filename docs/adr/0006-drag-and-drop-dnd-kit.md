# 6. Drag and drop: dnd-kit

Status: Accepted
Date: 2026-07-07

## Context

The planner grid supports adding and removing sections by dragging, and every
drag must have a keyboard equivalent for accessibility. Section meeting times
are fixed, so a drag is a commit gesture rather than a reschedule.

## Decision

Use dnd-kit with pointer and keyboard sensors. Placement validation runs once at
drag start because every footprint position is fixed, which keeps the drag itself
cheap to render.

## Alternatives considered

react-beautiful-dnd is no longer maintained. Building drag handling by hand would
reimplement sensor and accessibility work that dnd-kit already provides and tests.

## Consequences

Drag interactions and their keyboard equivalents share the same validation path.
The library is React specific, which aligns with the chosen UI runtime.

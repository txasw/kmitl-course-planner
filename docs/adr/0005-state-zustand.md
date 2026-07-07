# 5. State: Zustand

Status: Accepted
Date: 2026-07-07

## Context

The interface holds several independent pieces of state: the catalog search
surface, the active plans, and the transient UI. Plans must persist across page
reloads, while catalog and UI state are session scoped.

## Decision

Use Zustand stores, one per concern, with a persistence adapter over extension
storage for the plan store only. Stores are plain and testable outside React.

## Alternatives considered

Redux carries more boilerplate than this surface needs. React context with
reducers would spread state logic across the component tree and complicate
testing outside the renderer.

## Consequences

Persistence is explicit and limited to plans, keeping the catalog and UI stores
free of storage concerns. Store logic can be unit tested without rendering
components.

# 7. Runtime validation: Zod

Status: Accepted
Date: 2026-07-07

## Context

Every byte the extension reads from the network, from storage, or from an
imported plan file is untrusted. The domain layer must reject shapes that drift
from the documented contract before they reach application state.

## Decision

Use Zod schemas at every trust boundary: API responses, storage reads, imported
plan JSON, and inbound runtime messages. Types are inferred from the schemas so
the validated shape and the static type never diverge.

## Alternatives considered

Hand written type guards would duplicate the type and the runtime check and drift
over time. Trusting the network shape and relying only on static types would let
malformed data corrupt plans silently.

## Consequences

Schemas are the single source of truth for boundary types. A shape that fails
validation surfaces a typed error rather than a broken render, and the schemas
double as documentation of the observed contract.

# 8. Messaging: typed protocol

Status: Accepted
Date: 2026-07-07

## Context

All network egress happens in the background service worker so that caching,
retries, timeouts, and host permissions stay centralized. The content script
requests data across the worker boundary, which loses type information and
prototypes.

## Decision

Define a typed request and response protocol in one module as a discriminated
union of message types, with a generic typed send helper. The worker router
validates the sender identity and the message shape before handling. Errors
cross the boundary as tagged plain objects and are rehydrated on the other side.

## Alternatives considered

Ad hoc message objects would lose compile time safety across the worker boundary
and invite drift between sender and handler. Passing raw errors would fail
because structured clone drops prototypes.

## Consequences

Message shapes are checked at compile time and validated at runtime. A single
protocol module is the contract that both sides import.

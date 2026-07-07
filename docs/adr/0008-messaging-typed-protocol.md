# 8. Messaging: typed protocol

Status: Accepted
Date: 2026-07-07

## Context

All network egress happens in the background service worker so that caching,
retries, timeouts, and host permissions stay centralized. The content script
requests data across the worker boundary, which loses type information and
prototypes.

## Decision

Hand roll a typed request and response protocol in one module as a discriminated
union of message types, with a generic typed send helper. No messaging library is
used. The worker router validates the sender identity against the runtime id and
the message shape with Zod before handling. Errors cross the boundary as tagged
plain objects and are read directly on the other side, because the error taxonomy
is modelled as plain objects discriminated by a kind field rather than Error
subclasses, so structured clone preserves them and no rehydration is needed.

## Alternatives considered

Ad hoc message objects would lose compile time safety across the worker boundary
and invite drift between sender and handler.

A messaging library, @webext-core/messaging, was considered and rejected. Its
model serializes and rethrows errors on the caller side, which conflicts with the
never throw discipline where every operation already returns a tagged plain object
Result. It also provides neither sender identity validation nor per message Zod
validation, both of which the security checklist requires and which must be written
regardless, so the library would remove no code while adding a dependency. The
decision table gate, adopt only if it reduces code without adding risk, therefore
rules it out.

## Consequences

Message shapes are checked at compile time and validated at runtime. A single
protocol module is the contract that both sides import.

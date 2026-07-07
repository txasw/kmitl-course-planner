# 18. UI preferences storage key

Status: Accepted
Date: 2026-07-08

## Context

The panel persists user interface preferences, starting with the language choice.
ADR-0005 limits the persistence adapter to the plan store, and the plan root schema
under kcp:v1 holds only plans. The plan store binding is deferred to a later phase.

## Decision

Persist UI preferences under a separate content owned key, kcp:prefs, validated by
its own Zod schema, rather than inside the plan root. The content script owns this
write, disjoint from the plan root and from the worker owned kcp:cache namespace, so
the write ownership split holds. Preferences are read on mount and written on
explicit change.

## Alternatives considered

Folding preferences into the kcp:v1 plan root was rejected because it would require
wiring the plan store to storage now, pulling later phase work forward, and would
couple an unrelated preference to the plan schema and its migrations. Persisting the
whole ui store through the state library persistence middleware was rejected because
ADR-0005 limits persistence to the plan store, and only a small explicit slice of the
ui state is durable.

## Consequences

Preferences survive reloads without touching the plan root or the plan store binding.
A future preference is added to the same key and schema. If preferences ever need to
merge into the plan root, a migration moves them and this record is superseded.

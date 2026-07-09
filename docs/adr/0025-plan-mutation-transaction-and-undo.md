# 25. Plan mutation transaction and undo model

Status: Accepted
Date: 2026-07-09

## Context

The planner grew from add and remove to also move a placed section to another section
of its subject and swap a blocking section for an incoming one. A move removes the
origin and adds the target; a swap removes the blocker, sometimes also the dragged
origin, and adds the incoming section. Each is a single gesture that both removes and
adds, and each must be one atomic, undoable step: the remove and the add can never half
apply, and one undo must reverse the whole thing.

The existing pieces did not compose safely for this. The pure layer had separate add
and remove functions, so a move or swap built by calling them in sequence could leave
the plan half changed if the add failed after the remove. The store's undo held only
the removed group, which reverses a plain remove but not a mutation that also added.
Worse, the add path cleared the pending undo, so a move or swap implemented by reusing
add would wipe the very undo record it needed.

## Decision

One pure primitive expresses every plan mutation, and one store method records its
undo. `applyPlanTransaction(entries, removeIds, add, now)` folds the removals (each
pulling its declared pair) to a reduced entry list, then validates and appends the
incoming group against that reduced list; on any conflict it returns the conflicts and
changes nothing. Add is `removeIds` empty, remove is `add` null, move removes the
origin, and swap removes the blocker and, for a moved block, the origin too. Because it
computes the whole result on a local value and only the store commits it, a mutation is
atomic by construction.

The undo record generalizes from a removed list to an added and removed pair. A single
store method applies a transaction and, in one update, sets the new entries and records
what it added and removed, so the internal add cannot clear the undo it just set. Undo
drops what was added and restores what was removed, returning a prior valid state
without revalidation. The record stays one shape so the feedback strip renders it in a
single branch.

This refines the placement feedback model in ADR 0021: the strip still owns the ten
second undo window and the blocked reason, but the mutation behind a removal is now any
transaction, not only a removal.

## Alternatives considered

Separate move and swap functions layered over add and remove were rejected because they
duplicate the remove then add shape and reintroduce the half applied risk the single
primitive removes. Keeping the removed only undo and adding a second parallel undo path
for move and swap was rejected because two undo shapes force the strip to branch and
invite the two of them to disagree. Making the add path record an undo so move and swap
could reuse it was rejected because a plain add is deliberately not undoable, only
removable, and folding an undo into it would change that contract for every caller.

## Consequences

There is one tested mutation primitive and one undo shape, so a new gesture is a new
choice of `removeIds` and `add` rather than new mutation or undo code. A mutation never
half applies, and one undo reverses a remove, a move, or a swap alike. The strip stays a
single branch. A future gesture that removes several entries and adds one, such as a
multi way exchange, already fits the primitive with no new plumbing.

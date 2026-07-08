# 21. Placement feedback interaction model

Status: Accepted
Date: 2026-07-08

## Context

A section has a fixed footprint: its meetings sit on set days and times, so a drag
cannot reschedule it, only place it or not. The planner needs to tell the student
before they commit whether a section will fit and, when it will not, why and what
would fit instead. Recomputing conflicts on every pointer frame would be wasteful
and would make the drag feel expensive, and scattering the reason wording across
the pointer chip and the feedback strip would let one conflict read two ways.

## Decision

Validate a placement once, at drag start, and hold the result for the whole drag.
A small drag store records the active section, its atomic group, and the placement
result; the grid ghosts, the blocking pulse, the not allowed cursor, and the
pointer reason chip all read that one result rather than recomputing. A valid drag
shows success soft footprint ghosts and a drop commits silently, since silence is
the message when everything fits. A blocked drag shows danger soft hatched ghosts
and drops commit nothing; the rejected drop moves into a blocked feedback that the
strip renders with the reason and up to two alternative sections that would fit,
ordered by earliest start with unscheduled ones last, or a reveal action when none
do. One shared helper turns a conflict into its sentence so the chip and the strip
agree. Removal confirms in the same strip with a ten second undo. The strip is a
distinct aria-live region, not the toast, which stays reserved for actions whose
outcome is not otherwise visible on screen.

## Alternatives considered

Per frame revalidation during the drag was rejected because the footprint is fixed,
so the answer cannot change mid drag, and recomputing wastes work and complicates
the render. Blocking the drop only at release with no in flight feedback was
rejected because it hides the outcome until it is too late to redirect. Routing the
blocked reason through the global toast was rejected because a blocked placement is
an on screen outcome tied to the grid, which the strip already owns, while the
toast is for outcomes with no other on screen signal.

## Consequences

The drag is cheap to render because validation runs once. The reason wording lives
in one place, so the chip and the strip never disagree. The feedback vocabulary
stays small: valid is silent, blocked names the first conflict and offers
alternatives. Future placement rules, such as the exam overlap warning, extend the
same single validation and the same strip rather than adding new surfaces.

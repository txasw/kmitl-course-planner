# 61. Section offeredTo derived from curriculum groupings

Status: Accepted
Date: 2026-11-06

Amends Section 5.2 step 4 of the project brief (deduplication keeps the first row and records
nothing else) and ADR-0037, which states that a repeated `teach_table_id` is a whole row duplicate
from the curriculum groupings.

## Context

The teach table response is an array of curriculum groupings, each identified by `faculty_id`,
`department_id`, `curriculum2_id` and `class`. The same section row repeats under every grouping
it is scheduled for. Deduplication by `teach_table_id` keeps the first row, which is correct for
the section's own fields, but it discards which groupings the section appeared under. That
membership is the only signal in the data that tells a student which section of a course is meant
for their curriculum and class year. In the by_subject_id capture, 41 of 44 sections of 90641007
appear under more than one grouping, and section 101 appears under 22.

A filter for the sections open to a student's curriculum needs this membership on the normalized
section, and the details surface needs it on the plan snapshot, since the grid and the block
details render from snapshots and never from the catalog.

## Decision

Deduplication still keeps the first row of each `teach_table_id` and still counts the dropped rows
the same way, so the unique section count and the duplicate count do not change. It now also
collects the groupings each id appeared under into an `offeredTo` list on the section, in first
seen order, with a repeated grouping recorded once.

Each item holds ids only: `facultyId`, `departmentId`, `curriculumId` (from `curriculum2_id`, the
value the search sends as `selected_curriculum`) and `classYear` (from `class`). The raw strings are
kept as received. The `x` department and curriculum sentinels and the class `0` of the catch all
groupings mean any, and ids vary in zero padding, so a consumer compares through `idsEqual` and
treats those sentinels as wildcards rather than the domain layer rewriting them. Display names are
not stored. They resolve at render from the cached faculty, department and curriculum reference
lists, so they follow the locale and a renamed curriculum, and they cost no snapshot space.

`offeredTo` is an optional field of the section and of the snapshot schema. A plan stored or
exported before this change has no field and still parses, and buildSnapshot and
snapshotToSection carry the field only when present. Revalidation rebuilds the snapshot from the
fresh section, so the list refreshes on every reconcile, but diffSnapshot does not compare it and
no change kind exists for it. Grouping membership depends on the query that produced the section, so
a list that differs between two queries is not a change to the section a student enrolls in, and
treating it as one would raise review noise on every plan built from more than one search.

The list describes only the query that produced it. A by_class search returns the selected
grouping and the faculty catch all grouping, with no section under both, so its sections carry one
item even when the same section is open to other curricula. The filter that
consumes the field states that scope in its copy.

Snapshot size. The extension holds only the `storage` permission, without `unlimitedStorage`, so
every stored byte counts against the browser quota for `storage.local`. Storing ids keeps an item
to about 80 bytes. A unit test serializes the 90641007/101 snapshot with its 22 groupings and holds
it under a fixed byte budget, so a dense plan stays far inside the quota.

## Alternatives considered

Storing the grouping names beside the ids was rejected. It roughly multiplies the item size by
five with Thai and English names, it freezes a name that the reference data already serves, and
the names are null on the catch all groupings anyway.

Resolving membership on demand by keeping the raw response was rejected. The raw response is
transient, the grid renders from snapshots, and a plan reopened after a reload has no raw response
to read.

Adding an `offered_changed` change kind was rejected for the scope reason above: the same section
reached through a category search and through a subject id search carries different lists, so the
kind would fire without any change a student needs to act on.

Normalizing the ids, for example padding to two digits or mapping `x` to null, was rejected. The
reference endpoints themselves vary in width, and one comparison helper already exists for that.

## Consequences

Every normalized section carries a non empty `offeredTo`, and every new plan entry stores it, so
snapshots grow by about 80 bytes per grouping. A plan entry added from a subject id or category
search stores the widest list, bounded by the number of groupings in that one response. The
contract auditor is unchanged, since the grouping fields are already validated by the response
schema. The curriculum filter and the details row that read the field follow as separate changes.

## Amendment, 2026-11-06: the curriculum filter and the details row

The filter popover gains an open to my curriculum switch. It keeps a section when any one of its
`offeredTo` groupings matches the student's curriculum profile: the faculty, department,
curriculum, and class year compared through `idsEqual`, with the `x` department and curriculum
and the class `0` read as any on the data side only. A wildcard never crosses a faculty, and a
grouping such as the faculty 90 General Education grouping is read literally, since the
sentinels defined for the data are `x` and class `0` alone. A section with no list, which only a
snapshot stored before this field can be, is kept, because the filter hides only what it can
judge. The switch carries the scope note as its accessible description, since a by_class search
lists one grouping per section.

The profile is an optional field of the preferences blob, held in the ui store and written by the
one persistence hook, so a save never drops it. It names one real grouping, so its schema refuses
the `x` sentinel, the search form's all option, and class year `0`; a stored profile that fails
validation is dropped alone and the other preferences survive. The first time the switch turns on
with no profile, an inline picker opens in the popover. It reuses the class tab's selects as
`CurriculumFields` without the all options and without the term, prefilled from the class search
form with its all values cleared, and the filter turns on only once a complete profile applies;
cancelling leaves it off. A separate settings surface was rejected, since the brief allows no
options page and the choice matters only to this filter.

The full block details list the groupings under an open to row, named through the cached
reference lists in the words the search summary uses, with the raw ids while the lists load. Its
note says the list comes from the search the section was added from, which revalidation replays,
because a snapshot's list belongs to that query and not to the search on screen. The compact hover
card leaves the row out.

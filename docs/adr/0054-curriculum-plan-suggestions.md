# 54. Curriculum plan suggestions

Status: Accepted
Date: 2026-11-06

Builds on brief sections 5.3 (the conflict engine) and 4.7 (one request per user action), and on
ADR-0025 (one transaction primitive) and ADR-0036 (exam overlap is a hard block).

## Context

The owner asked for the planner to propose a timetable: the combination of sections that fits the
most curriculum courses, or the most credits, with a choice of shape such as mornings or
afternoons, applied to the grid in one action. A curriculum search returns every section of every
subject the curriculum offers that term, so the planner already holds the data. What it lacked was
a way to pick one section per subject without a clash.

The teach table splits each curriculum grouping under two headings. Group 1 holds GenEd and free
electives, which a student takes or leaves by choice. Group 2 holds the faculty required,
curriculum required and curriculum elective subjects that a curriculum expects. A suggestion is
only meaningful for the second group.

## Decision

Scope. Suggestions apply to curriculum results, that is a `by_class` search, and choose only group
2 courses. `classifySubjectGroup` in `lib/catalog/subjectGroup.ts` reads the leading group number
of the heading in Thai or English and returns curriculum, general or unknown. A heading that names
no group, or whose two languages disagree, is unknown, and an unknown course is never a
candidate. The debug contract auditor checks both headings against the same patterns at warn
severity, so drift reaches the data quality report instead of quietly removing courses from the
suggestion set. A subject already in the plan is not a candidate.

Hard rules equal the add rules. A section group, meaning a section with its declared pair, is an
option only when every member is open according to `computeSeatStatus`, and two options fit
together only when `checkPlacement` accepts them. Time overlap, exam overlap, pair atomicity and
duplicate subjects therefore follow ADR-0036 and section 5.3 exactly. Exams are compared as
datetime ranges, so two courses whose exams fall on the same day at different times are not a
clash, while two courses whose sections all sit one shared exam window cannot both be chosen. The
request suggested the rules might cover the class timetable only, since some subjects hold one exam
for all their sections. Exams stay in because the add gate would refuse such a pair anyway, and the
left out reason names the clash.

Locked entries. Every entry already in the active plan, for example a GenEd the student picked, is
a fixed constraint. Applying a suggestion creates a new plan for the term holding those entries
plus the chosen groups, and leaves the active plan unchanged. `applySuggestion` builds the entries
through `applyPlanTransaction` one course at a time, so applying cannot place anything the add
gate would refuse, even when the plan changed after the search.

Objective and preference. `coverAll` ranks by curriculum courses and then credits, and
`maxCredits` ranks the other way round. A tie goes to the lower preference penalty: minutes of
class after noon for morning, minutes before noon for afternoon, distinct class days for fewer
days, idle minutes between classes on the same day for compact, and class days times 60 plus idle
minutes for balanced. Any remaining tie is broken by subject id and then numeric section code, so
the same input always gives the same three suggestions.

Search. `suggestPlans` in `lib/planner/suggest.ts` runs an exhaustive depth first search. It visits
courses with the fewest options first, and each course takes one of its options or is skipped.
Every rule `checkPlacement` applies is pairwise, so each option is checked once against the locked
entries, and the rest of the checks come from a memoized pairwise table. Branch and bound prunes a
subtree when its best reachable objective, from the remaining courses and credits, cannot beat the
worst kept suggestion. On a tie it also prunes when the least reachable penalty cannot beat it.
That bound is exact for minutes and days, and it omits idle time because a later class can fill a
gap. Only maximal timetables are kept, because skipping a course that still fits would produce a
strictly better timetable. A node cap of 200000 stops the search and marks the result truncated.
On the with-exams capture, 98 curriculum courses, a capped run took about 45 ms in a local test
run, and the by_class capture finishes uncapped well inside the 50 ms its timing test allows.

Explanations. Every curriculum course left out of a suggestion carries a reason. The reasons are:
all sections full or closed; an exam overlap that every open section shares with a named subject;
a clash between every open section and a named locked entry; or no section fits beside the chosen
courses.

No extra requests. The search reads only the result already on screen and the plan, per brief
section 4.7. It sends nothing and needs no new permission.

## Alternatives considered

A greedy pass that takes the course with the fewest options first was rejected, because it cannot
promise the most courses or the most credits, and the student asked for exactly that. An integer
programming or constraint solver library was rejected because the inputs are small, a dependency
would add bundle weight and audit surface, and the solver would have to restate the conflict rules
instead of calling `checkPlacement`. Suggesting GenEd and free electives was rejected because they
are the student's choice, and filling a timetable with them would bury the curriculum courses.
Including subsets of the best timetable as weaker suggestions was rejected, because a suggestion
that leaves out a course that fits is never what a student wants. Replacing the active plan on
apply was rejected because the student loses the plan they built. A new plan keeps both plans and
fits the existing switcher.

## Consequences

The suggestion engine is pure and framework free, and the UI that offers it is a separate change.
A result truncated by the node cap is still conflict free but may not be the best timetable, so
the interface must say so. On the with-exams capture the capped run keeps 22 courses where a
longer search finds at least 24, so the notice matters. If a real result runs past 50 ms, the
interface runs the search in idle chunks. Because the rules come from `checkPlacement`, a future change to the add gate changes
suggestions in the same step. A heading wording change that keeps the group number has no
effect. One that drops the number turns the affected courses unknown, and the debug report shows
the drift.

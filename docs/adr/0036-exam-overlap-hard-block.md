# 36. Exam overlap is a hard block

Status: Accepted
Date: 2026-07-12

## Context

Phase 8 shipped exam overlap as a warning, not a block: a section whose midterm or
final window overlapped a placed section's still added, and the clash surfaced in the
feedback strip and on a warn badge. That choice was made without live data, because no
captured payload carried exam datetimes; the four exam fields were always null in the
captures then on hand, so the warning was built against the documented shape alone.

A fresh live capture now populates the exam fields. The datetimes arrive as the fixed
width `YYYY-MM-DD HH:MM:SS`, and their year is the Gregorian (CE) year, not the Buddhist
year the term selectors use: a query for Buddhist year 2569 returns exam dates in 2026.
In real registration an exam clash cannot be sat, so an overlap is a hard constraint, the
same class as a time conflict, not advice a student can choose to ignore.

## Decision

Exam overlap becomes a hard block enforced in `checkPlacement`, which gains an `exam`
`ConflictDetail` kind alongside `time` and `duplicate`: a midterm against a midterm and a
final against a final, cross type never, with half open adjacency so back to back exams do
not clash, and a declared lecture and practice pair never blocking itself on its shared
exam. Because `checkPlacement` and the transaction layer are the one gate, every path
inherits the rule with no scattered checks: the drag, the add button, course drag
candidates, the swap validation, and the suggestion chips, which never offer an exam
conflicting alternative because they filter on the same gate. An unscheduled section is
gated too, since having no meeting does not remove its exam.

Ordering compares the raw datetime strings lexicographically, which is chronological within
one era and needs no parser. The era is recorded as CE in `lib/parsing/examDateTime`, which
extracts the fields directly and never constructs a `Date` from the space separated form;
display converts the CE year to the Buddhist year the app shows in both locales, with the
month name localized. The four fields stay `z.string().nullable()` at the Zod boundary so a
single malformed value degrades one field rather than blanking the catalog during
registration season; the format authority lives in the parser regex and the contract
auditor expectations, and a non null value that fails the format is recorded as a per row
normalization warning so a silent format drift is observable.

An exam overlap discovered among already placed entries, which can now only arise through
revalidation or an import rather than a fresh add, reads danger like a newly created time
conflict, with a distinct label so a screen reader hears it apart from a revalidation
change. The transient after add warning is removed, since a clashing add no longer succeeds.

## Consequences

- A plan populated before this change lights up danger on first open after upgrade wherever
  its snapshots already carry genuinely overlapping exams. This is the designed discovered
  conflict path, not a regression; nothing is removed automatically.
- The exam warning vocabulary shrinks: the strip states an exam block through the same
  rejected drop path as a time conflict, so there is one blocked feedback surface, not two.
- The rule depends on the exam datetimes being present and well formed. Where a section
  carries no exam, or a malformed one, it is treated as no window and never blocks, and the
  malformed case is surfaced as a normalization warning and an auditor issue.

This amends the Phase 8 exam warning decision in Section 5.3 of the project brief.

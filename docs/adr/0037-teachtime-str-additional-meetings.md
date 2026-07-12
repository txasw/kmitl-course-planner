# 37. teachtime_str carries a section's additional meetings

Status: Accepted
Date: 2026-07-12

## Context

Live QA found that subject 01476101 section 34 meets twice on the same Thursday,
08:45 to 10:15 and 10:30 to 12:00, which the host site renders joined with a plus
sign. The extension drew only the first period on the grid, so the conflict engine
never learned about the second. A grid that omits real class time makes the conflict
tool lie, which is the silent disappearance failure class this project set out to
avoid, and it shipped in v1.1.0.

The working hypothesis was that the API emits one row per meeting sharing one
`teach_table_id`, and that the dedupe by `teach_table_id` in the normalization
pipeline kept the first occurrence and dropped the rest. A fresh capture disproves
this. In `teach-table.multi-meeting.capture.json` the section is a single row,
`teach_table_id` 124252, whose primary meeting sits in `teach_day`, `teach_time`,
and `teach_time2`, and whose second period is encoded in the `teachtime_str` string
as `5x10:30-12:00`. There is one row and one id, so the dedupe is innocent; the
additional meeting was in a field the normalizer never parsed.

### The spec is the origin of the bug

The project brief caused this, and the honest record is worth keeping. Section 4.1
described `teachtime_str` as a display string and instructed "Do not depend on it".
Section 5.1 anticipated multi meeting sections but framed them as rows to "merge
that share `teachTableId` if the API ever splits them", a data shape that does not
exist. The implementation followed both faithfully: it ignored `teachtime_str` and
never saw a split row, so the extra meetings had nowhere to come from. The
misjudgment is the instruction to ignore the field, not the implementation.

### The grammar, derived from a census rather than a guess

Every non empty `teachtime_str` across the committed captures and fixtures was
enumerated before any parser was written. The census is 11 distinct values: 10
conform to the machine grammar, 1 does not, and none repeats the primary meeting.

```
[OK]   x6  "1x13:00-16:00,1x16:30-19:30"
[OK]   x4  "6x10:30-12:00"
[OK]   x4  "7x13:00-16:00,7x16:30-19:30"
[OK]   x2  "5x10:30-12:00"       the QA case, 01476101/34
[OK]   x2  "6x17:30-19:00"       segment day 6 differs from the primary day 5
[OK]   x2  "4x10:30-12:00"
[OK]   x2  "3x10:30-12:00"
[OK]   x2  "4x17:00-19:00"       segment day 4 differs from the primary day 3
[OK]   x1  "2x14:45-16:15"
[OK]   x1  "4x14:45-16:15"
[FAIL] x1  "จ. 09:00-12:00"      a hand made display string, in one fixture only
```

The grammar is `teachtime_str := segment ("," segment)*` and
`segment := <day 1-7> "x" <H:MM> "-" <H:MM>`, no seconds. It lists only the
additional meetings, never the primary. The segment day can differ from `teach_day`,
so a section can meet on two different days. Up to two segments appear, so a section
can total three meetings. The one non conforming value is a Thai display string that
no real capture produces; it lived in a reconstructed regression fixture, which has
been rebuilt to an honest machine grammar value, and the rejected display shape is
kept as a parser unit test so the lesson stays encoded where invented shapes belong.

## Decision

Parse `teachtime_str` into additional `Meeting` objects during normalization. The
grammar lives in one place, `lib/parsing/teachTimeStr.ts`, which the contract auditor
imports so the two cannot fork. Extra meetings inherit the row's room, building, and
kind, the only schedule data the API provides for them. Meetings are deduplicated
within a section by day and minute bounds and ordered by day then start, so a segment
that coincides with the primary never double renders or self conflicts. A section is
unscheduled only when its final meeting set is empty; a day 0 sentinel row that still
carries `teachtime_str` meetings keeps them and records a mixed shape warning.

The dedupe by `teach_table_id` and the identity model are unchanged. The 5.1 hedge
about the API splitting a section into rows sharing one id stays a hedge: no capture
exhibits it, so a defensive merge would be code with no real data to test, which the
no tech debt rule forbids, and the contract auditor with the fixture loop is the
tripwire if the API ever starts splitting rows. A same id repeat is still a whole row
duplicate that collapses exactly as before.

A non empty `teachtime_str` that does not parse fails visibly: the normalizer records
a per row warning and the auditor flags a `format_violation`. The expectation table
carries the machine grammar as the field's format, at warn severity rather than
error, because the primary meeting still renders and the per row warning already
surfaces the drift; error stays reserved for shapes that would silently cost meetings.
The data quality report and the catalog summary both gain a count of the sections that
carry extra meetings, so the periods that were silently dropped are now visible.

Every downstream surface already iterated a section's full meeting set, so the fix is
confined to the parser, the normalizer, and the contract. The catalog row, the grid,
the copy as text export, the per day load, the fit to content bounds, the placement
engine, and the revalidation differ needed no change; tests were added to lock that in.

## Consequences

- A plan saved before this change has one meeting snapshots. On first open after the
  upgrade, revalidation classifies the grown meeting set as `time_changed`, rewrites
  the snapshot to the full schedule, and re runs the conflict engine, which can
  surface a newly true conflict the plan did not show before. This is the designed
  discovered conflict path, not a regression, and nothing is removed automatically.
- The contract now depends on `teachtime_str` conforming to the machine grammar. A
  future display format or a new separator would read as drift through the auditor and
  a normalization warning, which is the intended early signal, and the fixture loop is
  the path to fold a genuinely new real shape into the grammar.

This amends Sections 4.1, 5.1, and 5.2 of the project brief: `teachtime_str` is a
parsed field carrying a section's additional meetings, not a display string to ignore,
and a Section's `meetings` array accumulates the primary meeting plus the parsed
`teachtime_str` meetings rather than merged split rows.
